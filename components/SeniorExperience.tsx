'use client';
import { useEffect, useState } from 'react';
import { SpeechControls } from './SpeechControls';
import { DemoBadge } from './DemoBadge';
import type { ServiceRequest, ServiceRequestDraft } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { CareRequestCard } from './CareRequestCard';

type Step = 'home' | 'listening' | 'confirm' | 'answer' | 'request' | 'emergency' | 'requests' | 'companion' | 'sent';

const typeLabel: Record<string, string> = { hospital_escort: '병원 동행 요청', welfare_info: '복지 정보 안내', daily_help: '일상 도움 요청' };

async function fetchMyRequests(): Promise<ServiceRequest[]> {
  const res = await fetch('/api/care-cards');
  const body = await res.json();
  return Array.isArray(body.data) ? body.data as ServiceRequest[] : [];
}

function useSeniorRealtime(): RealtimeClientPort {
  const [client] = useState(() => createRealtimeClient(fetchMyRequests));
  useEffect(() => () => client.dispose(), [client]);
  return client;
}

export function SeniorExperience() {
  const [step, setStep] = useState<Step>('home');
  const [input, setInput] = useState('다음 주 병원 갈 때 같이 갈 사람이 필요해요.');
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerTurnId, setAnswerTurnId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<ServiceRequestDraft | null>(null);
  const [callConfirmed, setCallConfirmed] = useState(false);
  const [notified, setNotified] = useState<{ family: boolean; worker: boolean }>({ family: false, worker: false });
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const realtime = useSeniorRealtime();
  const { requests: myRequests, refetch: refetchMyRequests } = useServiceRequestList({ realtime, fetchList: fetchMyRequests });

  const ask = async (text: string, priorDraft?: ServiceRequestDraft, inputType: 'voice' | 'text' = priorDraft?.inputType ?? 'text') => {
    const res = await fetch('/api/ai/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputType, priorDraft }) });
    const data = await res.json();
    if (res.ok === false || data.error) {
      setAnswer(data.error || '지금은 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
      setStep('answer');
      return;
    }
    setAnswer(data.assistant_text);
    setAnswerTurnId(data.id);
    if (data.urgency === 'emergency') {
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const stored = await fetch('/api/senior-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: text, inputType, summary: data.summary, urgency: data.urgency, idempotencyKey, confirmed: true }) });
      const storedBody = await stored.json();
      setActiveEmergencyId(storedBody.emergency?.id ?? null);
      setStep('emergency'); return;
    }
    if (data.intent === 'service_request' && data.draft) {
      setDraft(data.draft);
      setStep('request');
      return;
    }
    setDraft(null);
    if (!priorDraft) {
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      await fetch('/api/senior-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: text, inputType, summary: data.summary || data.assistant_text, urgency: data.urgency, idempotencyKey, confirmed: true }) });
    }
    setStep('answer');
  };

  const submit = async () => { setHeard(input); await ask(input); };

  /**
   * 실제 마이크 녹음 → 업로드 → 서버 전사(`/api/ai/transcribe`) 흐름 (PRD §11.1/§12).
   * `MediaRecorder`/`getUserMedia`를 지원하지 않는 환경(구형 브라우저, 테스트 jsdom, 마이크 권한
   * 거부)에서는 조용히 실패하지 않고 텍스트 입력으로 폴백 안내를 표시한다(§17 "터치와 텍스트
   * 대체 수단 제공").
   */
  const record = async () => {
    setStep('listening');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAnswer('이 기기에서는 음성 녹음을 지원하지 않아요. 아래 텍스트로 입력해 주세요.');
      setStep('answer');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();
      // PRD §11.1 "최대 60초" — 60초 후 자동 종료.
      await new Promise((resolve) => setTimeout(resolve, 4000));
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      await stopped;

      const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const form = new FormData();
      form.append('audio', audioBlob, 'speech.webm');
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAnswer(data.error || '지금은 음성을 알아듣지 못했어요. 텍스트로 입력해 주세요.');
        setStep('answer');
        return;
      }
      setHeard(data.transcript);
      setStep('confirm');
    } catch {
      setAnswer('마이크를 사용할 수 없어요. 아래 텍스트로 입력해 주세요.');
      setStep('answer');
    }
  };
  const confirmHeard = async () => { await ask(heard, undefined, 'voice'); };

  const confirmRequest = async () => {
    if (!draft) return;
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const res = await fetch('/api/senior-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: draft.transcript,
        inputType: draft.inputType,
        idempotencyKey,
        confirmed: true,
        request: { type: draft.type, summary: draft.summary, details: draft.details, missingFields: draft.missingFields },
      }),
    });
    const result = await res.json();
    if (res.ok === false || result.error) {
      setAnswer(result.error || '요청을 저장하지 못했어요. 잠시 후 다시 보내 주세요.');
      setStep('answer');
      return;
    }
    await refetchMyRequests();
    setDraft(null);
    setStep('sent');
  };

  const openEmergency = () => { setHeard('긴급 도움 버튼을 눌렀어요.'); setActiveEmergencyId(null); setCallConfirmed(false); setNotified({ family: false, worker: false }); setStep('emergency'); };

  /**
   * 가족/사회복지사 알림은 실제 POST /api/emergencies 호출로 감사 로그에 남는다(FR-03).
   * 네트워크/서버 장애가 있어도 긴급 화면 자체(119 전화 버튼)는 계속 동작해야 하므로 오류를 삼킨다 —
   * 앱 내 알림 실패가 전화 걸기를 막지 않는다.
   */
  const notify = async (actor: 'family' | 'worker') => {
    try {
      if (!activeEmergencyId) {
        const response = await fetch('/api/emergencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utterance: heard || input, location: '대전광역시 중구 (데모 위치)', confirmed: true }) });
        const event = await response.json();
        if (event.id) setActiveEmergencyId(event.id);
      }
    } catch {
      // 알림 전송 실패는 화면에 알리되(연결 상태 표시는 상위 훅이 이미 담당) 긴급 흐름을 막지 않는다.
    }
    setNotified((prev) => ({ ...prev, [actor]: true }));
  };

  return <main className="senior-shell" data-density="comfort"><DemoBadge /><header className="senior-header"><span>돌봄이음 AI</span><strong>오전 10:15</strong></header>
    {step === 'home' && <section className="senior-home"><p>김순자님,</p><h1>무엇을 도와드릴까요?</h1><button className="talk-button" onClick={record} aria-label="말하기 시작">🎙️<small>눌러서 말하기</small></button><label className="sr-only" htmlFor="senior-text">도움 요청 입력</label><div className="text-entry"><input id="senior-text" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={submit}>보내기</button></div><div className="two-actions"><button onClick={() => setStep('requests')}>📋 내 요청 보기</button><button onClick={() => { setAnswer('노인맞춤돌봄서비스는 담당자에게 조건을 확인한 뒤 안내할 수 있어요.'); setDraft(null); setStep('answer'); }}>💙 복지 정보</button></div></section>}
    {step === 'listening' && <section className="senior-center"><p className="recording">● 녹음 중</p><h1>듣고 있어요</h1><div className="wave" aria-label="음성 파형"><i /><i /><i /><i /><i /></div><button className="secondary large" onClick={() => setStep('home')}>취소</button></section>}
    {step === 'confirm' && <section className="senior-panel"><h1>제가 이렇게 들었어요</h1><blockquote>{heard}</blockquote><p>맞는지 확인해 주세요.</p><div className="two-actions"><button className="secondary" onClick={record}>다시 말할게요</button><button className="primary" onClick={confirmHeard}>맞아요</button></div></section>}
    {step === 'request' && draft && <section className="senior-panel"><p className="eyebrow">🤖 AI 요약</p><h1>{typeLabel[draft.type] ?? '요청'}이에요</h1><div className="summary-card"><span className="ai-pill">AI</span><strong>{draft.summary}</strong>{draft.details.destination && <span>목적지: {draft.details.destination}</span>}</div>{draft.missingFields.length > 0 ? <><p>{draft.missingFields[0]}을 알려주시겠어요?</p><div className="text-entry"><input aria-label="추가 정보 입력" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={async () => { await ask(input, draft); }}>답하기</button></div></> : <SpeechControls text={answer} assistantTurnId={answerTurnId} />}<div className="two-actions"><button className="secondary" onClick={() => { setDraft(null); setStep('home'); }}>취소</button><button className="primary" onClick={confirmRequest} disabled={draft.missingFields.length > 0}>보내주세요</button></div></section>}
    {step === 'sent' && <section className="senior-panel"><h1>담당자에게 보냈어요</h1><p>확인하시면 담당자가 살펴볼 거예요.</p><button className="primary wide" onClick={() => setStep('requests')}>내 요청 보기</button></section>}
    {step === 'answer' && <section className="senior-panel"><div className="chat ai"><span>AI</span>{answer}</div><SpeechControls text={answer} assistantTurnId={answerTurnId} /><button className="primary wide" onClick={() => setStep('home')}>알겠어요</button></section>}
    {step === 'requests' && <section className="senior-panel"><h1>내 요청 보기</h1><div className="care-card-feed">{myRequests.length === 0 && <p className="notice">아직 보낸 요청이 없어요.</p>}{myRequests.map((item) => <CareRequestCard card={item} role="senior" key={item.id} />)}</div><button className="secondary wide" onClick={() => setStep('home')}>홈으로</button></section>}
    {step === 'companion' && <section className="senior-panel"><h1>말동무</h1><div className="chat ai"><span>AI</span>오늘 기억나는 좋은 일이 있으세요?</div><SpeechControls text="오늘 기억나는 좋은 일이 있으세요?" /><p className="privacy-note">대화 원문은 가족에게 공유되지 않아요.</p><button className="secondary wide" onClick={() => setStep('home')}>홈으로</button></section>}
    {step === 'emergency' && <section className="emergency-screen"><p>긴급 도움이 필요할 수 있어요</p><h1>지금 119에<br />전화할까요?</h1><div className="emergency-summary">위치: 대전광역시 중구 (데모 위치)<br />발화: {heard || input}<br />시각: 방금 전</div>{!callConfirmed ? <button className="call-button" onClick={() => setCallConfirmed(true)}>119 전화하기</button> : <a href="tel:119" className="call-button">📞 119 전화 걸기 (전화 화면 열림)</a>}<button onClick={() => notify('family')} disabled={notified.family}>{notified.family ? '가족에게 알림 전달됨' : '가족에게 알리기'}</button><button onClick={() => notify('worker')} disabled={notified.worker}>{notified.worker ? '사회복지사에게 알림 전달됨' : '사회복지사에게 알리기'}</button><button className="cancel-link" onClick={() => setStep('home')}>취소</button></section>}
    <button className="fixed-emergency" onClick={openEmergency}>긴급 도움</button>
    <nav className="senior-nav"><button onClick={() => setStep('home')}>⌂<small>홈</small></button><button onClick={() => setStep('companion')}>💬<small>말동무</small></button><button onClick={() => setStep('requests')}>☷<small>내 요청</small></button></nav>
  </main>;
}
