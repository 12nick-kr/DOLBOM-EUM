'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { SpeechControls } from './SpeechControls';
import { DemoBadge } from './DemoBadge';
import type { RequestInputType, ServiceRequest, ServiceRequestDraft } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { CareRequestCard } from './CareRequestCard';

type RequestSource = { transcript: string; inputType: RequestInputType };
type Screen =
  | { view: 'home' }
  | { view: 'listening'; phase: 'preparing' | 'recording' | 'transcribing' }
  | { view: 'review'; source: RequestSource }
  | { view: 'analyzing'; source: RequestSource }
  | { view: 'request'; draft: ServiceRequestDraft }
  | { view: 'submitting'; draft: ServiceRequestDraft }
  | { view: 'sent' }
  | { view: 'info' }
  | { view: 'error'; message: string; source?: RequestSource }
  | { view: 'emergency' }
  | { view: 'requests' };

type ScreenAction =
  | { type: 'HOME' }
  | { type: 'LISTENING'; phase: 'preparing' | 'recording' | 'transcribing' }
  | { type: 'REVIEW'; source: RequestSource }
  | { type: 'ANALYZING'; source: RequestSource }
  | { type: 'REQUEST'; draft: ServiceRequestDraft }
  | { type: 'SUBMITTING'; draft: ServiceRequestDraft }
  | { type: 'SENT' }
  | { type: 'INFO' }
  | { type: 'ERROR'; message: string; source?: RequestSource }
  | { type: 'EMERGENCY' }
  | { type: 'REQUESTS' };

function screenReducer(_state: Screen, action: ScreenAction): Screen {
  switch (action.type) {
    case 'HOME': return { view: 'home' };
    case 'LISTENING': return { view: 'listening', phase: action.phase };
    case 'REVIEW': return { view: 'review', source: action.source };
    case 'ANALYZING': return { view: 'analyzing', source: action.source };
    case 'REQUEST': return { view: 'request', draft: action.draft };
    case 'SUBMITTING': return { view: 'submitting', draft: action.draft };
    case 'SENT': return { view: 'sent' };
    case 'INFO': return { view: 'info' };
    case 'ERROR': return { view: 'error', message: action.message, source: action.source };
    case 'EMERGENCY': return { view: 'emergency' };
    case 'REQUESTS': return { view: 'requests' };
  }
}

const typeLabel: Record<string, string> = {
  hospital_escort: '병원 동행 요청',
  welfare_info: '복지 정보 안내',
  daily_help: '일상 도움 요청',
};
const welfareInfoText = '노인맞춤돌봄서비스는 담당자에게 조건을 확인한 뒤 안내할 수 있어요.';

async function fetchMyRequests(): Promise<ServiceRequest[]> {
  const res = await fetch('/api/care-cards');
  if (res.ok === false) throw new Error('내 요청 목록 조회 실패');
  const body = await res.json();
  return Array.isArray(body.data) ? body.data as ServiceRequest[] : [];
}

function useSeniorRealtime(): RealtimeClientPort {
  const [client] = useState(() => createRealtimeClient(fetchMyRequests));
  useEffect(() => () => client.dispose(), [client]);
  return client;
}

export function SeniorExperience() {
  const [screen, dispatch] = useReducer(screenReducer, { view: 'home' });
  const [input, setInput] = useState('다음 주 병원 갈 때 같이 갈 사람이 필요해요.');
  const [followUpInput, setFollowUpInput] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [answerTurnId, setAnswerTurnId] = useState<string | undefined>();
  const [requestError, setRequestError] = useState('');
  const [callConfirmed, setCallConfirmed] = useState(false);
  const [notified, setNotified] = useState<{ family: boolean; worker: boolean }>({ family: false, worker: false });
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [emergencyUtterance, setEmergencyUtterance] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardRecordingRef = useRef(false);
  const analysisInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const realtime = useSeniorRealtime();
  const { requests: myRequests, isLoading, upsertOptimistically } = useServiceRequestList({ realtime, fetchList: fetchMyRequests });

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const cancelPendingRequests = () => {
    analysisAbortRef.current?.abort();
    saveAbortRef.current?.abort();
    analysisAbortRef.current = null;
    saveAbortRef.current = null;
    analysisInFlightRef.current = false;
    saveInFlightRef.current = false;
  };

  useEffect(() => () => {
    analysisAbortRef.current?.abort();
    saveAbortRef.current?.abort();
    discardRecordingRef.current = true;
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stopTracks();
  }, []);

  const analyzeRequest = async (text: string, inputType: RequestInputType, priorDraft?: ServiceRequestDraft) => {
    const normalized = text.trim();
    if (!normalized || analysisInFlightRef.current) return;
    analysisInFlightRef.current = true;
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setRequestError('');
    const source = { transcript: priorDraft?.transcript ?? normalized, inputType };
    dispatch({ type: 'ANALYZING', source });
    try {
      const res = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalized, inputType, purpose: 'service_request', priorDraft }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok === false || data.error) {
        dispatch({ type: 'ERROR', message: data.error || '지금은 신청 내용을 분석할 수 없어요. 잠시 후 다시 시도해 주세요.', source });
        return;
      }
      setAssistantText(data.assistant_text ?? '요청 내용을 정리했어요. 맞는지 확인해 주세요.');
      setAnswerTurnId(data.id);
      if (data.urgency === 'emergency') {
        const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        const stored = await fetch('/api/senior-inputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: normalized, inputType, summary: data.summary, urgency: data.urgency, idempotencyKey, confirmed: true }),
          signal: controller.signal,
        });
        const storedBody = await stored.json();
        if (controller.signal.aborted) return;
        setEmergencyUtterance(normalized);
        setActiveEmergencyId(storedBody.emergency?.id ?? null);
        dispatch({ type: 'EMERGENCY' });
        return;
      }
      if (data.intent !== 'service_request' || !data.draft) {
        dispatch({ type: 'ERROR', message: '신청 내용을 카드로 정리하지 못했어요. 원문을 확인하고 다시 분석해 주세요.', source });
        return;
      }
      setFollowUpInput('');
      dispatch({ type: 'REQUEST', draft: data.draft as ServiceRequestDraft });
    } catch {
      if (controller.signal.aborted) return;
      dispatch({ type: 'ERROR', message: '서버에 연결할 수 없어요. 입력한 내용은 그대로 보관했으니 다시 시도해 주세요.', source });
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
        analysisInFlightRef.current = false;
      }
    }
  };

  const reviewTextInput = () => {
    const transcript = input.trim();
    if (!transcript) {
      dispatch({ type: 'ERROR', message: '도움이 필요한 내용을 먼저 입력해 주세요.' });
      return;
    }
    dispatch({ type: 'REVIEW', source: { transcript, inputType: 'text' } });
  };

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      dispatch({ type: 'ERROR', message: '이 기기에서는 음성 녹음을 지원하지 않아요. 텍스트로 입력해 주세요.' });
      return;
    }
    discardRecordingRef.current = false;
    dispatch({ type: 'LISTENING', phase: 'preparing' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        recorderRef.current = null;
        stopTracks();
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }
        dispatch({ type: 'LISTENING', phase: 'transcribing' });
        try {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const form = new FormData();
          form.append('audio', audioBlob, 'speech.webm');
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : '';
          if (!res.ok || data.error || !transcript) {
            dispatch({ type: 'ERROR', message: data.error || '음성을 알아듣지 못했어요. 다시 말하거나 텍스트로 입력해 주세요.' });
            return;
          }
          dispatch({ type: 'REVIEW', source: { transcript, inputType: 'voice' } });
        } catch {
          dispatch({ type: 'ERROR', message: '음성을 글로 바꾸지 못했어요. 다시 말하거나 텍스트로 입력해 주세요.' });
        }
      };
      recorder.start();
      dispatch({ type: 'LISTENING', phase: 'recording' });
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 60_000);
    } catch {
      stopTracks();
      dispatch({ type: 'ERROR', message: '마이크를 사용할 수 없어요. 권한을 확인하거나 텍스트로 입력해 주세요.' });
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      dispatch({ type: 'LISTENING', phase: 'transcribing' });
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else stopTracks();
    dispatch({ type: 'HOME' });
  };

  const editSource = (source: RequestSource) => {
    setInput(source.transcript);
    dispatch({ type: 'HOME' });
  };

  const confirmRequest = async () => {
    if (screen.view !== 'request' || saveInFlightRef.current) return;
    const draft = screen.draft;
    saveInFlightRef.current = true;
    const controller = new AbortController();
    saveAbortRef.current = controller;
    setRequestError('');
    dispatch({ type: 'SUBMITTING', draft });
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await fetch('/api/senior-inputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: draft.transcript, inputType: draft.inputType, idempotencyKey, confirmed: true, request: { type: draft.type, summary: draft.summary, details: draft.details, missingFields: draft.missingFields } }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const result = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok === false || result.error) {
        setRequestError(result.error || '요청을 저장하지 못했어요. 잠시 후 다시 보내 주세요.');
        dispatch({ type: 'REQUEST', draft });
        return;
      }
      if (result.card) upsertOptimistically(result.card as ServiceRequest);
      dispatch({ type: 'SENT' });
    } catch {
      if (controller.signal.aborted) return;
      setRequestError('서버에 연결할 수 없어요. 신청 내용은 유지했으니 다시 보내 주세요.');
      dispatch({ type: 'REQUEST', draft });
    } finally {
      if (saveAbortRef.current === controller) {
        saveAbortRef.current = null;
        saveInFlightRef.current = false;
      }
    }
  };

  const openEmergency = () => {
    cancelPendingRequests();
    cancelRecording();
    setEmergencyUtterance('긴급 도움 버튼을 눌렀어요.');
    setActiveEmergencyId(null);
    setCallConfirmed(false);
    setNotified({ family: false, worker: false });
    dispatch({ type: 'EMERGENCY' });
  };

  const notify = async (actor: 'family' | 'worker') => {
    try {
      if (!activeEmergencyId) {
        const response = await fetch('/api/emergencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utterance: emergencyUtterance || input, location: '대전광역시 중구 (데모 위치)', confirmed: true }) });
        const event = await response.json();
        if (event.id) setActiveEmergencyId(event.id);
      }
    } catch {
      // 앱 내 알림 실패가 119 전화 흐름을 막지 않도록 긴급 화면을 그대로 유지한다.
    }
    setNotified((previous) => ({ ...previous, [actor]: true }));
  };

  const requestDraft = screen.view === 'request' || screen.view === 'submitting' ? screen.draft : null;
  const showFooter = screen.view !== 'emergency';

  return <main className="senior-shell" data-density="comfort">
    <DemoBadge />
    <header className="senior-header"><span>돌봄이음 AI</span><strong>오전 10:15</strong></header>

    {screen.view === 'home' && <section className="senior-home"><p>김순자님,</p><h1>무엇을 도와드릴까요?</h1><button className="talk-button" onClick={startRecording} aria-label="말하기 시작">🎙️<small>눌러서 말하기</small></button><label className="sr-only" htmlFor="senior-text">도움 요청 입력</label><div className="text-entry"><input id="senior-text" value={input} onChange={(event) => setInput(event.target.value)} /><button onClick={reviewTextInput}>보내기</button></div><div className="two-actions"><button onClick={() => dispatch({ type: 'REQUESTS' })}>📋 내 요청 보기</button><button onClick={() => dispatch({ type: 'INFO' })}>💙 복지 정보</button></div></section>}

    {screen.view === 'listening' && <section className="senior-center" aria-live="polite"><p className={screen.phase === 'recording' ? 'recording' : 'eyebrow'}>{screen.phase === 'recording' ? '● 녹음 중' : screen.phase === 'transcribing' ? '음성을 글로 바꾸는 중' : '마이크 준비 중'}</p><h1>{screen.phase === 'recording' ? '듣고 있어요' : screen.phase === 'transcribing' ? '잠시만 기다려 주세요' : '마이크를 준비하고 있어요'}</h1><div className="wave" aria-label="음성 파형"><i /><i /><i /><i /><i /></div>{screen.phase === 'recording' ? <button className="primary large" onClick={stopRecording}>녹음 마치기</button> : <p className="notice" role="status">{screen.phase === 'transcribing' ? '인식이 끝나면 원문 확인 화면이 열려요.' : '곧 녹음이 시작돼요.'}</p>}<button className="secondary large" onClick={cancelRecording}>취소</button></section>}

    {screen.view === 'review' && <section className="senior-panel"><p className="eyebrow">2단계 · 원문 확인</p><h1>입력한 내용이 맞나요?</h1><article className="request-data-card original-card"><span>{screen.source.inputType === 'voice' ? '음성 인식 원문' : '텍스트 입력 원문'}</span><blockquote>{screen.source.transcript}</blockquote></article><p>맞으면 AI가 신청 카드로 정리해 드려요.</p><div className="two-actions"><button className="secondary" onClick={() => editSource(screen.source)}>수정하기</button><button className="primary" onClick={() => analyzeRequest(screen.source.transcript, screen.source.inputType)}>이 내용 분석하기</button></div></section>}

    {screen.view === 'analyzing' && <section className="senior-center analysis-progress" aria-live="polite"><p className="eyebrow">3단계 준비 중</p><h1>AI가 신청 내용을<br />정리하고 있어요.</h1><div className="analysis-dots" aria-hidden="true"><i /><i /><i /></div><p className="notice" role="status">AI가 신청 내용을 정리하고 있어요.</p></section>}

    {screen.view === 'error' && <section className="senior-panel" role="alert"><h1>다시 확인해 주세요</h1><p>{screen.message}</p>{screen.source ? <div className="two-actions"><button className="secondary" onClick={() => editSource(screen.source!)}>원문 수정</button><button className="primary" onClick={() => dispatch({ type: 'REVIEW', source: screen.source! })}>다시 시도</button></div> : <button className="primary wide" onClick={() => dispatch({ type: 'HOME' })}>텍스트로 입력하기</button>}</section>}

    {requestDraft && <section className="senior-panel"><p className="eyebrow">3단계 · 신청 내용 확인</p><h1>{typeLabel[requestDraft.type] ?? '요청'}이에요</h1><div className="request-comparison" aria-label="사용자 원문과 AI 요약"><article className="request-data-card original-card"><span>{requestDraft.inputType === 'voice' ? '음성 인식 원문' : '텍스트 입력 원문'}</span><blockquote>{requestDraft.transcript}</blockquote></article><article className="request-data-card summary-card"><span className="ai-pill">AI 요약</span><strong>{requestDraft.summary}</strong>{requestDraft.details.destination && <span>목적지: {String(requestDraft.details.destination)}</span>}{requestDraft.details.desiredAt && <span>희망 날짜: {String(requestDraft.details.desiredAt)}</span>}</article></div>{screen.view === 'submitting' ? <p className="notice" role="status">담당자에게 요청 카드를 보내고 있어요.</p> : <>{requestError && <p className="notice error-notice" role="alert">{requestError}</p>}{requestDraft.missingFields.length > 0 ? <><p>{requestDraft.missingFields[0]}을 알려주시겠어요?</p><div className="text-entry"><input aria-label="추가 정보 입력" value={followUpInput} onChange={(event) => setFollowUpInput(event.target.value)} /><button onClick={() => analyzeRequest(followUpInput, requestDraft.inputType, requestDraft)}>내용 추가</button></div><button className="secondary wide" onClick={() => editSource({ transcript: requestDraft.transcript, inputType: requestDraft.inputType })}>원문 수정</button></> : <><SpeechControls text={assistantText} assistantTurnId={answerTurnId} /><div className="two-actions"><button className="secondary" onClick={() => editSource({ transcript: requestDraft.transcript, inputType: requestDraft.inputType })}>원문 수정</button><button className="primary" onClick={confirmRequest}>보내주세요</button></div></>}</>}</section>}

    {screen.view === 'sent' && <section className="senior-panel"><h1>담당자에게 보냈어요</h1><p>요청 카드가 전달됐어요. 담당자가 확인하면 상태가 바로 바뀌어요.</p><button className="primary wide" onClick={() => dispatch({ type: 'REQUESTS' })}>내 요청 보기</button></section>}
    {screen.view === 'info' && <section className="senior-panel"><div className="chat ai"><span>AI</span>{welfareInfoText}</div><SpeechControls text={welfareInfoText} /><button className="primary wide" onClick={() => dispatch({ type: 'HOME' })}>확인했어요</button></section>}
    {screen.view === 'requests' && <section className="senior-panel"><h1>내 요청 보기</h1><div className="care-card-feed">{isLoading && <p className="notice" role="status">요청을 불러오는 중이에요.</p>}{!isLoading && myRequests.length === 0 && <p className="notice">아직 보낸 요청이 없어요.</p>}{myRequests.map((item) => <CareRequestCard card={item} role="senior" key={item.id} />)}</div><button className="secondary wide" onClick={() => dispatch({ type: 'HOME' })}>홈으로</button></section>}

    {screen.view === 'emergency' && <section className="emergency-screen"><p>긴급 도움이 필요할 수 있어요</p><h1>지금 119에<br />전화할까요?</h1><div className="emergency-summary">위치: 대전광역시 중구 (데모 위치)<br />발화: {emergencyUtterance || input}<br />시각: 방금 전</div>{!callConfirmed ? <button className="call-button" onClick={() => setCallConfirmed(true)}>119 전화하기</button> : <a href="tel:119" className="call-button">📞 119 전화 걸기 (전화 화면 열림)</a>}<button onClick={() => notify('family')} disabled={notified.family}>{notified.family ? '가족에게 알림 전달됨' : '가족에게 알리기'}</button><button onClick={() => notify('worker')} disabled={notified.worker}>{notified.worker ? '사회복지사에게 알림 전달됨' : '사회복지사에게 알리기'}</button><button className="cancel-link" onClick={() => dispatch({ type: 'HOME' })}>취소</button></section>}

    {showFooter && <footer className="senior-footer"><button className="emergency-dock-action" onClick={openEmergency}>긴급 도움</button><nav className="senior-nav" aria-label="노인 화면 메뉴"><button onClick={() => { cancelPendingRequests(); dispatch({ type: 'HOME' }); }}>⌂<small>홈</small></button><button onClick={() => { cancelPendingRequests(); dispatch({ type: 'REQUESTS' }); }}>☷<small>내 요청</small></button></nav></footer>}
  </main>;
}
