'use client';
import { useState } from 'react';
import { SpeechControls } from './SpeechControls';
import { DemoBadge } from './DemoBadge';
import { StatusPill } from './StatusPill';
import { statusLabelFor } from '@/lib/domain/policies';
import type { ServiceRequestDraft } from '@/lib/domain/types';

type Step = 'home' | 'listening' | 'confirm' | 'answer' | 'request' | 'emergency' | 'requests' | 'companion' | 'sent';
type MyRequest = { id: string; type: string; status: 'new' | 'in_progress' | 'done' | 'rejected'; summary: string };

const typeLabel: Record<string, string> = { hospital_escort: '병원 동행 요청', welfare_info: '복지 정보 안내', daily_help: '일상 도움 요청' };

export function SeniorExperience() {
  const [step, setStep] = useState<Step>('home');
  const [input, setInput] = useState('다음 주 병원 갈 때 같이 갈 사람이 필요해요.');
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const [draft, setDraft] = useState<ServiceRequestDraft | null>(null);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  const ask = async (text: string, priorDraft?: ServiceRequestDraft) => {
    const res = await fetch('/api/ai/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputType: 'text', priorDraft }) });
    const data = await res.json();
    setAnswer(data.assistant_text);
    if (data.urgency === 'emergency') { setStep('emergency'); return; }
    if (data.intent === 'service_request' && data.draft) {
      setDraft(data.draft);
      setStep('request');
      return;
    }
    setDraft(null);
    setStep('answer');
  };

  const submit = async () => { setHeard(input); await ask(input); };
  const record = async () => { setStep('listening'); await new Promise((resolve) => setTimeout(resolve, 700)); const res = await fetch('/api/ai/transcribe', { method: 'POST' }); const data = await res.json(); setHeard(data.transcript); setStep('confirm'); };
  const confirmHeard = async () => { await ask(heard); };

  const confirmRequest = async () => {
    if (!draft) return;
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const res = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: draft.type, summary: draft.summary, transcript: draft.transcript, inputType: draft.inputType, details: draft.details, missingFields: draft.missingFields, idempotencyKey, confirmed: true }),
    });
    const created = await res.json();
    setMyRequests((prev) => [{ id: created.id, type: draft.type, status: created.status, summary: draft.summary }, ...prev]);
    setDraft(null);
    setStep('sent');
  };

  return <main className="senior-shell" data-density="comfort"><DemoBadge /><header className="senior-header"><span>돌봄이음 AI</span><strong>오전 10:15</strong></header>
    {step === 'home' && <section className="senior-home"><p>김순자님,</p><h1>무엇을 도와드릴까요?</h1><button className="talk-button" onClick={record} aria-label="말하기 시작">🎙️<small>눌러서 말하기</small></button><label className="sr-only" htmlFor="senior-text">도움 요청 입력</label><div className="text-entry"><input id="senior-text" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={submit}>보내기</button></div><div className="two-actions"><button onClick={() => setStep('requests')}>📋 내 요청 보기</button><button onClick={() => { setAnswer('노인맞춤돌봄서비스는 담당자에게 조건을 확인한 뒤 안내할 수 있어요.'); setDraft(null); setStep('answer'); }}>💙 복지 정보</button></div></section>}
    {step === 'listening' && <section className="senior-center"><p className="recording">● 녹음 중</p><h1>듣고 있어요</h1><div className="wave" aria-label="음성 파형"><i /><i /><i /><i /><i /></div><button className="secondary large" onClick={() => setStep('home')}>취소</button></section>}
    {step === 'confirm' && <section className="senior-panel"><h1>제가 이렇게 들었어요</h1><blockquote>{heard}</blockquote><p>맞는지 확인해 주세요.</p><div className="two-actions"><button className="secondary" onClick={record}>다시 말할게요</button><button className="primary" onClick={confirmHeard}>맞아요</button></div></section>}
    {step === 'request' && draft && <section className="senior-panel"><p className="eyebrow">🤖 AI 요약</p><h1>{typeLabel[draft.type] ?? '요청'}이에요</h1><div className="summary-card"><span className="ai-pill">AI</span><strong>{draft.summary}</strong>{draft.details.destination && <span>목적지: {draft.details.destination}</span>}</div>{draft.missingFields.length > 0 ? <><p>{draft.missingFields[0]}을 알려주시겠어요?</p><div className="text-entry"><input aria-label="추가 정보 입력" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={async () => { await ask(input, draft); }}>답하기</button></div></> : <SpeechControls text={answer} />}<div className="two-actions"><button className="secondary" onClick={() => { setDraft(null); setStep('home'); }}>취소</button><button className="primary" onClick={confirmRequest} disabled={draft.missingFields.length > 0}>보내주세요</button></div></section>}
    {step === 'sent' && <section className="senior-panel"><h1>담당자에게 보냈어요</h1><p>확인하시면 담당자가 살펴볼 거예요.</p><button className="primary wide" onClick={() => setStep('requests')}>내 요청 보기</button></section>}
    {step === 'answer' && <section className="senior-panel"><div className="chat ai"><span>AI</span>{answer}</div><SpeechControls text={answer} /><button className="primary wide" onClick={() => setStep('home')}>알겠어요</button></section>}
    {step === 'requests' && <section className="senior-panel"><h1>내 요청 보기</h1>{myRequests.length === 0 && <div className="request-card"><span className="pill amber">진행 중</span><strong>병원 동행 도움</strong><p>담당자가 확인 중이에요.</p></div>}{myRequests.map((item) => <div className="request-card" key={item.id}><StatusPill status={statusLabelFor('senior', item.status)} /><strong>{typeLabel[item.type] ?? item.type}</strong><p>{statusLabelFor('senior', item.status)}</p></div>)}<button className="secondary wide" onClick={() => setStep('home')}>홈으로</button></section>}
    {step === 'companion' && <section className="senior-panel"><h1>말동무</h1><div className="chat ai"><span>AI</span>오늘 기억나는 좋은 일이 있으세요?</div><SpeechControls text="오늘 기억나는 좋은 일이 있으세요?" /><p className="privacy-note">대화 원문은 가족에게 공유되지 않아요.</p><button className="secondary wide" onClick={() => setStep('home')}>홈으로</button></section>}
    {step === 'emergency' && <section className="emergency-screen"><p>긴급 도움이 필요할 수 있어요</p><h1>지금 119에<br />전화할까요?</h1><div className="emergency-summary">위치: 대전광역시 중구 (데모 위치)<br />발화: {heard || input}<br />시각: 방금 전</div><a href="tel:119" className="call-button">📞 119 전화하기</a><button onClick={() => alert('데모: 가족에게 앱 내 알림을 만들었어요.')}>가족에게 알리기</button><button onClick={() => alert('데모: 사회복지사에게 앱 내 알림을 만들었어요.')}>사회복지사에게 알리기</button><button className="cancel-link" onClick={() => setStep('home')}>취소</button></section>}
    <button className="fixed-emergency" onClick={() => { setHeard('긴급 도움 버튼을 눌렀어요.'); setStep('emergency'); }}>긴급 도움</button>
    <nav className="senior-nav"><button onClick={() => setStep('home')}>⌂<small>홈</small></button><button onClick={() => setStep('companion')}>💬<small>말동무</small></button><button onClick={() => setStep('requests')}>☷<small>내 요청</small></button></nav>
  </main>;
}
