'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { SpeechControls } from './SpeechControls';
import { DemoBadge } from './DemoBadge';
import { LogoutButton } from './LogoutButton';
import type { RequestInputType, ServiceRequest, ServiceRequestDraft } from '@/lib/domain/types';
import { formatDesiredDate } from '@/lib/domain/dateResolution';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { CareRequestCard } from './CareRequestCard';
import { createSilenceGate } from '@/lib/client/silenceGate';
import { registerAssistantSpeechToken } from '@/lib/client/speechTokenStore';

type RequestSource = { transcript: string; inputType: RequestInputType };
type RecordingPurpose = 'request' | 'date_follow_up' | 'send_confirmation';
type RecordingStopReason = 'manual' | 'silence' | 'max_duration' | 'no_speech' | 'cancel';
type Screen =
  | { view: 'home' }
  | { view: 'listening'; phase: 'preparing' | 'recording' | 'transcribing'; purpose: RecordingPurpose }
  | { view: 'analyzing'; source: RequestSource }
  | { view: 'request' }
  | { view: 'submitting' }
  | { view: 'sent' }
  | { view: 'info' }
  | { view: 'error'; message: string; source?: RequestSource }
  | { view: 'emergency' }
  | { view: 'requests' };

type ScreenAction =
  | { type: 'HOME' }
  | { type: 'LISTENING'; phase: 'preparing' | 'recording' | 'transcribing'; purpose: RecordingPurpose }
  | { type: 'ANALYZING'; source: RequestSource }
  | { type: 'REQUEST' }
  | { type: 'SUBMITTING' }
  | { type: 'SENT' }
  | { type: 'INFO' }
  | { type: 'ERROR'; message: string; source?: RequestSource }
  | { type: 'EMERGENCY' }
  | { type: 'REQUESTS' };

function screenReducer(_state: Screen, action: ScreenAction): Screen {
  switch (action.type) {
    case 'HOME': return { view: 'home' };
    case 'LISTENING': return { view: 'listening', phase: action.phase, purpose: action.purpose };
    case 'ANALYZING': return { view: 'analyzing', source: action.source };
    case 'REQUEST': return { view: 'request' };
    case 'SUBMITTING': return { view: 'submitting' };
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
const DATE_PROMPT = '오늘, 내일, 이번 주 중 언제가 편하세요? “내일 오전”처럼 말씀해 주세요.';
const SEND_PROMPT = '요청 내용을 카드로 정리했어요. 이 요청을 담당자에게 보내시겠습니까?';
const EMERGENCY_PROMPT = '긴급 도움이 필요할 수 있어요. 지금 119에 전화할까요?';
const SILENCE_DURATION_MS = 3000;
const NO_SPEECH_TIMEOUT_MS = 10_000;
const MAX_RECORDING_MS = 60_000;

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
  const [requestDraft, setRequestDraftState] = useState<ServiceRequestDraft | null>(null);
  const [requestError, setRequestError] = useState('');
  const [callConfirmed, setCallConfirmed] = useState(false);
  const [notified, setNotified] = useState<{ family: boolean; worker: boolean }>({ family: false, worker: false });
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [emergencyUtterance, setEmergencyUtterance] = useState('');
  const [emergencyCloseConfirm, setEmergencyCloseConfirm] = useState(false);
  const [emergencyClosePending, setEmergencyClosePending] = useState(false);
  const [emergencyError, setEmergencyError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceAnimationRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingPurposeRef = useRef<RecordingPurpose>('request');
  const recordingStopReasonRef = useRef<RecordingStopReason>('manual');
  const recordingStartInFlightRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const requestDraftRef = useRef<ServiceRequestDraft | null>(null);
  const analysisInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const realtime = useSeniorRealtime();
  const { requests: myRequests, isLoading, upsertOptimistically } = useServiceRequestList({ realtime, fetchList: fetchMyRequests });

  const updateRequestDraft = (draft: ServiceRequestDraft | null) => {
    requestDraftRef.current = draft;
    setRequestDraftState(draft);
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopVoiceDetection = () => {
    if (voiceAnimationRef.current !== null) cancelAnimationFrame(voiceAnimationRef.current);
    voiceAnimationRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  };

  const cancelPendingRequests = () => {
    analysisAbortRef.current?.abort();
    saveAbortRef.current?.abort();
    analysisAbortRef.current = null;
    saveAbortRef.current = null;
    analysisInFlightRef.current = false;
    saveInFlightRef.current = false;
  };

  const stopRecorder = (recorder: MediaRecorder, reason: RecordingStopReason) => {
    if (recorder.state === 'inactive') return;
    recordingStopReasonRef.current = reason;
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    stopVoiceDetection();
    if (reason !== 'cancel' && reason !== 'no_speech') dispatch({ type: 'LISTENING', phase: 'transcribing', purpose: recordingPurposeRef.current });
    recorder.stop();
  };

  useEffect(() => () => {
    cancelPendingRequests();
    discardRecordingRef.current = true;
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    stopVoiceDetection();
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalized, inputType, purpose: 'service_request', priorDraft }), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok === false || data.error) {
        dispatch({ type: 'ERROR', message: data.error || '지금은 신청 내용을 분석할 수 없어요. 잠시 후 다시 시도해 주세요.', source });
        return;
      }
      if (data.urgency === 'emergency') {
        const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        const stored = await fetch('/api/senior-inputs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: normalized, inputType, summary: data.summary, urgency: data.urgency, idempotencyKey, confirmed: true }), signal: controller.signal,
        });
        const storedBody = await stored.json();
        if (controller.signal.aborted) return;
        setEmergencyUtterance(normalized);
        setActiveEmergencyId(storedBody.emergency?.id ?? null);
        setEmergencyCloseConfirm(false);
        setEmergencyError('');
        dispatch({ type: 'EMERGENCY' });
        return;
      }
      if (data.intent !== 'service_request' || !data.draft) {
        dispatch({ type: 'ERROR', message: '신청 내용을 카드로 정리하지 못했어요. 원문을 수정해 다시 보내 주세요.', source });
        return;
      }
      const draft = data.draft as ServiceRequestDraft;
      const spokenText = draft.missingFields.includes('희망 날짜') ? DATE_PROMPT : SEND_PROMPT;
      setAssistantText(spokenText);
      setAnswerTurnId(data.assistant_text === spokenText ? data.id : undefined);
      if (data.assistant_text === spokenText) registerAssistantSpeechToken(data.id, data.speech_token);
      setFollowUpInput('');
      updateRequestDraft(draft);
      dispatch({ type: 'REQUEST' });
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

  const submitTextInput = () => {
    const transcript = input.trim();
    if (!transcript) {
      dispatch({ type: 'ERROR', message: '도움이 필요한 내용을 먼저 입력해 주세요.' });
      return;
    }
    void analyzeRequest(transcript, 'text');
  };

  const startSilenceDetection = (stream: MediaStream, recorder: MediaRecorder) => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = performance.now();
      const silenceGate = createSilenceGate({ silenceDurationMs: SILENCE_DURATION_MS, noSpeechTimeoutMs: NO_SPEECH_TIMEOUT_MS });
      const detect = () => {
        if (recorder.state === 'inactive') return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();
        const elapsed = now - startedAt;
        const gateResult = silenceGate.observe(rms, elapsed);
        if (gateResult === 'silence_complete') {
          stopRecorder(recorder, 'silence');
          return;
        }
        if (gateResult === 'no_speech') {
          stopRecorder(recorder, 'no_speech');
          return;
        }
        voiceAnimationRef.current = requestAnimationFrame(detect);
      };
      voiceAnimationRef.current = requestAnimationFrame(detect);
    } catch {
      // Web Audio를 지원하지 않는 기기에서도 수동 종료와 60초 상한은 계속 작동한다.
    }
  };

  const startRecording = async (purpose: RecordingPurpose = 'request') => {
    if (recordingStartInFlightRef.current || (recorderRef.current && recorderRef.current.state !== 'inactive')) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      dispatch({ type: 'ERROR', message: '이 기기에서는 음성 녹음을 지원하지 않아요. 텍스트로 입력해 주세요.' });
      return;
    }
    recordingStartInFlightRef.current = true;
    recordingPurposeRef.current = purpose;
    recordingStopReasonRef.current = 'manual';
    discardRecordingRef.current = false;
    window.speechSynthesis?.cancel();
    dispatch({ type: 'LISTENING', phase: 'preparing', purpose });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        recorderRef.current = null;
        recordingStartInFlightRef.current = false;
        stopVoiceDetection();
        stopTracks();
        if (discardRecordingRef.current || recordingStopReasonRef.current === 'cancel') {
          discardRecordingRef.current = false;
          return;
        }
        if (recordingStopReasonRef.current === 'no_speech') {
          dispatch({ type: 'ERROR', message: '목소리가 들리지 않았어요. 다시 말하거나 텍스트로 입력해 주세요.' });
          return;
        }
        dispatch({ type: 'LISTENING', phase: 'transcribing', purpose });
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
          if (purpose === 'date_follow_up' && requestDraftRef.current) await analyzeRequest(transcript, 'voice', requestDraftRef.current);
          else if (purpose === 'send_confirmation') handleVoiceConfirmation(transcript);
          else await analyzeRequest(transcript, 'voice');
        } catch {
          dispatch({ type: 'ERROR', message: '음성을 글로 바꾸지 못했어요. 다시 말하거나 텍스트로 입력해 주세요.' });
        }
      };
      recorder.start();
      recordingStartInFlightRef.current = false;
      dispatch({ type: 'LISTENING', phase: 'recording', purpose });
      startSilenceDetection(stream, recorder);
      recordingTimerRef.current = setTimeout(() => stopRecorder(recorder, 'max_duration'), MAX_RECORDING_MS);
    } catch {
      recordingStartInFlightRef.current = false;
      stopVoiceDetection();
      stopTracks();
      dispatch({ type: 'ERROR', message: '마이크를 사용할 수 없어요. 권한을 확인하거나 텍스트로 입력해 주세요.' });
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder) stopRecorder(recorder, 'manual');
  };

  const cancelRecording = (returnHome = true) => {
    discardRecordingRef.current = true;
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    stopVoiceDetection();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') stopRecorder(recorder, 'cancel');
    else stopTracks();
    recordingStartInFlightRef.current = false;
    if (returnHome) dispatch({ type: 'HOME' });
  };

  const editSource = (source: RequestSource) => {
    setInput(source.transcript);
    updateRequestDraft(null);
    dispatch({ type: 'HOME' });
  };

  const confirmRequest = async () => {
    const draft = requestDraftRef.current;
    if (!draft || draft.missingFields.length > 0 || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const controller = new AbortController();
    saveAbortRef.current = controller;
    setRequestError('');
    dispatch({ type: 'SUBMITTING' });
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await fetch('/api/senior-inputs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: draft.transcript, inputType: draft.inputType, idempotencyKey, confirmed: true, request: { type: draft.type, summary: draft.summary, details: draft.details, missingFields: draft.missingFields } }), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const result = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok === false || result.error) {
        setRequestError(result.error || '요청을 저장하지 못했어요. 잠시 후 다시 보내 주세요.');
        dispatch({ type: 'REQUEST' });
        return;
      }
      if (result.card) upsertOptimistically(result.card as ServiceRequest);
      dispatch({ type: 'SENT' });
    } catch {
      if (controller.signal.aborted) return;
      setRequestError('서버에 연결할 수 없어요. 신청 내용은 유지했으니 다시 보내 주세요.');
      dispatch({ type: 'REQUEST' });
    } finally {
      if (saveAbortRef.current === controller) {
        saveAbortRef.current = null;
        saveInFlightRef.current = false;
      }
    }
  };

  const handleVoiceConfirmation = (transcript: string) => {
    const compact = transcript.replace(/\s/g, '');
    if (/네|예|맞아|보내|전송/.test(compact)) {
      void confirmRequest();
      return;
    }
    if (/아니|수정|취소/.test(compact)) {
      const draft = requestDraftRef.current;
      if (draft) editSource({ transcript: draft.transcript, inputType: draft.inputType });
      else dispatch({ type: 'HOME' });
      return;
    }
    setRequestError('“네, 보내주세요” 또는 “수정할게요”라고 말씀해 주세요. 버튼을 눌러도 돼요.');
    dispatch({ type: 'REQUEST' });
  };

  const openEmergency = () => {
    cancelPendingRequests();
    cancelRecording(false);
    updateRequestDraft(null);
    setEmergencyUtterance('긴급 도움 버튼을 눌렀어요.');
    setActiveEmergencyId(null);
    setCallConfirmed(false);
    setNotified({ family: false, worker: false });
    setEmergencyCloseConfirm(false);
    setEmergencyClosePending(false);
    setEmergencyError('');
    dispatch({ type: 'EMERGENCY' });
  };

  const notify = async (actor: 'family' | 'worker') => {
    try {
      if (!activeEmergencyId) {
        const response = await fetch('/api/emergencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utterance: emergencyUtterance || input, location: '대전광역시 중구 (데모 위치)', confirmed: true }) });
        const event = await response.json();
        if (!response.ok || !event.id) throw new Error('emergency_create_failed');
        setActiveEmergencyId(event.id);
      }
      setNotified((previous) => ({ ...previous, [actor]: true }));
    } catch {
      setEmergencyError('알림을 전달하지 못했어요. 119 전화 버튼은 계속 사용할 수 있어요.');
    }
  };

  const closeEmergency = async () => {
    if (emergencyClosePending) return;
    if (!activeEmergencyId) {
      setEmergencyCloseConfirm(false);
      dispatch({ type: 'HOME' });
      return;
    }
    setEmergencyClosePending(true);
    setEmergencyError('');
    try {
      const response = await fetch(`/api/emergencies/${activeEmergencyId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', action: '어르신이 긴급 상황을 종료했어요.', closeReason: 'senior_cancelled' }),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error('emergency_close_failed');
      window.dispatchEvent(new CustomEvent('dolbom:emergency-change'));
      setEmergencyCloseConfirm(false);
      setActiveEmergencyId(null);
      dispatch({ type: 'HOME' });
    } catch {
      setEmergencyError('긴급 상황을 종료하지 못했어요. 화면을 유지하고 다시 시도해 주세요.');
    } finally {
      setEmergencyClosePending(false);
    }
  };

  const submitFollowUp = () => {
    const draft = requestDraftRef.current;
    if (!draft || !followUpInput.trim()) return;
    void analyzeRequest(followUpInput, 'text', draft);
  };

  const desiredDateLabel = requestDraft ? formatDesiredDate(requestDraft.details) : undefined;
  const showFooter = screen.view !== 'emergency';

  return <main className="senior-shell" data-density="comfort">
    <DemoBadge />
    <header className="senior-header"><span>돌봄이음 AI</span><div className="session-actions"><strong>오전 10:15</strong><LogoutButton className="header-logout" /></div></header>
    {screen.view === 'home' && <section className="senior-home"><p>김순자님,</p><h1>무엇을 도와드릴까요?</h1><button className="talk-button" onClick={() => void startRecording('request')} aria-label="말하기 시작">🎙️<small>눌러서 말하기</small></button><label className="sr-only" htmlFor="senior-text">도움 요청 입력</label><div className="text-entry"><input id="senior-text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitTextInput(); }} /><button onClick={submitTextInput}>보내기</button></div><div className="two-actions"><button onClick={() => dispatch({ type: 'REQUESTS' })}>📋 내 요청 보기</button><button onClick={() => dispatch({ type: 'INFO' })}>💙 복지 정보</button></div></section>}
    {screen.view === 'listening' && <section className="senior-center" aria-live="polite"><p className={screen.phase === 'recording' ? 'recording' : 'eyebrow'}>{screen.phase === 'recording' ? '● 녹음 중' : screen.phase === 'transcribing' ? '음성을 글로 바꾸는 중' : '마이크 준비 중'}</p><h1>{screen.phase === 'recording' ? '말씀해 주세요' : screen.phase === 'transcribing' ? 'AI가 바로 정리하고 있어요' : '마이크를 준비하고 있어요'}</h1><div className="wave" aria-label="음성 파형"><i /><i /><i /><i /><i /></div>{screen.phase === 'recording' ? <><p className="notice">말씀이 끝난 뒤 3초가 지나면 자동으로 멈춰요.</p><button className="primary large" onClick={stopRecording}>지금 녹음 마치기</button></> : <p className="notice" role="status">{screen.phase === 'transcribing' ? '음성을 글로 바꾼 뒤 자동으로 분석해요.' : '곧 녹음이 시작돼요.'}</p>}<button className="secondary large" onClick={() => cancelRecording(true)}>취소</button></section>}
    {screen.view === 'analyzing' && <section className="senior-center analysis-progress" aria-live="polite"><p className="eyebrow">자동 분석 중</p><h1>AI가 신청 내용을<br />정리하고 있어요.</h1><div className="analysis-dots" aria-hidden="true"><i /><i /><i /></div><p className="notice" role="status">AI가 신청 내용을 정리하고 있어요.</p></section>}
    {screen.view === 'error' && <section className="senior-panel" role="alert"><h1>다시 확인해 주세요</h1><p>{screen.message}</p>{screen.source ? <div className="two-actions"><button className="secondary" onClick={() => editSource(screen.source!)}>원문 수정</button><button className="primary" onClick={() => void analyzeRequest(screen.source!.transcript, screen.source!.inputType)}>다시 시도</button></div> : <button className="primary wide" onClick={() => dispatch({ type: 'HOME' })}>텍스트로 입력하기</button>}</section>}
    {(screen.view === 'request' || screen.view === 'submitting') && requestDraft && <section className="senior-panel"><p className="eyebrow">신청 내용 확인</p><h1>{typeLabel[requestDraft.type] ?? '요청'}이에요</h1><div className="request-comparison" aria-label="사용자 원문과 AI 요약"><article className="request-data-card original-card"><span>{requestDraft.inputType === 'voice' ? '음성 인식 원문' : '텍스트 입력 원문'}</span><blockquote>{requestDraft.transcript}</blockquote></article><article className="request-data-card summary-card"><span className="ai-pill">AI 요약</span><strong>{requestDraft.summary}</strong>{requestDraft.details.destination && <span>목적지: {String(requestDraft.details.destination)}</span>}{desiredDateLabel && <span>희망 날짜: {desiredDateLabel}</span>}</article></div>{screen.view === 'submitting' ? <p className="notice" role="status">담당자에게 요청 카드를 보내고 있어요.</p> : <>{requestError && <p className="notice error-notice" role="alert">{requestError}</p>}{requestDraft.missingFields.includes('희망 날짜') ? <><div className="chat ai"><span>AI</span>{DATE_PROMPT}</div><SpeechControls text={assistantText || DATE_PROMPT} assistantTurnId={answerTurnId} autoPlay onCompleted={() => void startRecording('date_follow_up')} /><button className="primary wide" onClick={() => void startRecording('date_follow_up')}>음성으로 날짜 답하기</button><div className="text-entry"><input aria-label="희망 날짜 입력" value={followUpInput} onChange={(event) => setFollowUpInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitFollowUp(); }} placeholder="예: 내일 오전" /><button onClick={submitFollowUp}>내용 추가</button></div><button className="secondary wide" onClick={() => editSource({ transcript: requestDraft.transcript, inputType: requestDraft.inputType })}>원문 수정</button></> : <><div className="chat ai"><span>AI</span>{SEND_PROMPT}</div><SpeechControls text={assistantText || SEND_PROMPT} assistantTurnId={answerTurnId} autoPlay /><button className="secondary wide" onClick={() => void startRecording('send_confirmation')}>음성으로 네·아니요 답하기</button><div className="two-actions"><button className="secondary" onClick={() => editSource({ transcript: requestDraft.transcript, inputType: requestDraft.inputType })}>수정할게요</button><button className="primary" onClick={() => void confirmRequest()}>보내주세요</button></div></>}</>}</section>}
    {screen.view === 'sent' && <section className="senior-panel"><h1>담당자에게 보냈어요</h1><p>요청 카드가 전달됐어요. 담당자가 확인하면 상태가 바로 바뀌어요.</p><button className="primary wide" onClick={() => dispatch({ type: 'REQUESTS' })}>내 요청 보기</button></section>}
    {screen.view === 'info' && <section className="senior-panel"><div className="chat ai"><span>AI</span>{welfareInfoText}</div><SpeechControls text={welfareInfoText} autoPlay /><button className="primary wide" onClick={() => dispatch({ type: 'HOME' })}>확인했어요</button></section>}
    {screen.view === 'requests' && <section className="senior-panel"><h1>내 요청 보기</h1><div className="care-card-feed">{isLoading && <p className="notice" role="status">요청을 불러오는 중이에요.</p>}{!isLoading && myRequests.length === 0 && <p className="notice">아직 보낸 요청이 없어요.</p>}{myRequests.map((item) => <CareRequestCard card={item} role="senior" key={item.id} />)}</div><button className="secondary wide" onClick={() => dispatch({ type: 'HOME' })}>홈으로</button></section>}
    {screen.view === 'emergency' && <section className="emergency-screen"><p>긴급 도움이 필요할 수 있어요</p><h1>지금 119에<br />전화할까요?</h1><div className="emergency-summary">위치: 대전광역시 중구 (데모 위치)<br />발화: {emergencyUtterance || input}<br />시각: 방금 전</div><SpeechControls text={EMERGENCY_PROMPT} autoPlay compact />{emergencyError && <p className="emergency-error" role="alert">{emergencyError}</p>}{!callConfirmed ? <button className="call-button" onClick={() => setCallConfirmed(true)}>119 전화하기</button> : <><a href="tel:119" className="call-button">📞 119 전화 걸기 (전화 화면 열림)</a><p className="emergency-call-note">전화 화면을 연 뒤에는 앱에서 실제 통화를 취소할 수 없어요.</p></>}<button onClick={() => void notify('family')} disabled={notified.family}>{notified.family ? '가족에게 알림 전달됨' : '가족에게 알리기'}</button><button onClick={() => void notify('worker')} disabled={notified.worker}>{notified.worker ? '사회복지사에게 알림 전달됨' : '사회복지사에게 알리기'}</button>{!emergencyCloseConfirm ? <button className="emergency-close-action" onClick={() => setEmergencyCloseConfirm(true)}>긴급 상황 종료</button> : <div className="emergency-close-card" role="dialog" aria-label="긴급 상황 종료 확인"><strong>긴급 상황이 해결되었거나 잘못 눌렀나요?</strong><button onClick={() => setEmergencyCloseConfirm(false)}>계속 도움받기</button><button className="emergency-close-confirm" onClick={() => void closeEmergency()} disabled={emergencyClosePending}>{emergencyClosePending ? '종료하는 중' : '긴급 상황 종료'}</button></div>}</section>}
    {showFooter && <footer className="senior-footer"><button className="emergency-dock-action" onClick={openEmergency}>긴급 도움</button><nav className="senior-nav" aria-label="노인 화면 메뉴"><button onClick={() => { cancelPendingRequests(); dispatch({ type: 'HOME' }); }}>⌂<small>홈</small></button><button onClick={() => { cancelPendingRequests(); dispatch({ type: 'REQUESTS' }); }}>☷<small>내 요청</small></button></nav></footer>}
  </main>;
}
