'use client';
import { useEffect, useRef, useState } from 'react';
import type { SpeechStatus } from '@/lib/domain/types';
import { getAssistantSpeechToken } from '@/lib/client/speechTokenStore';

/** 서버 TTS가 5초 안에 응답하지 못하면 브라우저 speechSynthesis로 폴백한다 (PRD FR-07). */
const SERVER_TTS_TIMEOUT_MS = 5000;

type SpeechControlsProps = {
  text: string;
  assistantTurnId?: string;
  speechToken?: string;
  compact?: boolean;
  autoPlay?: boolean;
  onCompleted?: () => void;
};

export function SpeechControls({ text, assistantTurnId, speechToken, compact = false, autoPlay = false, onCompleted }: SpeechControlsProps) {
  const resolvedSpeechToken = speechToken ?? getAssistantSpeechToken(assistantTurnId);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onCompletedRef = useRef(onCompleted);
  const playRef = useRef<() => Promise<void>>(async () => undefined);
  const autoPlayedKeyRef = useRef('');
  onCompletedRef.current = onCompleted;

  const releaseAudioUrl = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  };

  const speakWithBrowser = () => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { setStatus('unavailable'); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.85;
    utterance.onstart = () => setStatus('playing');
    utterance.onend = () => { setStatus('completed'); onCompletedRef.current?.(); };
    utterance.onerror = () => setStatus('error');
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setStatus('completed');
  };

  /**
   * `assistant_turn_id`가 있으면 서버 TTS(`/api/ai/speech`)를 먼저 시도한다(PRD FR-07/TDD §3.7).
   * 서버가 실제 오디오(`audio/mpeg`)를 주면 그 음성을 재생하고, JSON `speech_status:
   * 'browser_fallback'`을 주거나 호출 자체가 5초 안에 끝나지 못하면 브라우저 음성으로 폴백한다.
   * `assistant_turn_id`가 없는 화면(예: 고정 안내 문구)은 서버 호출 없이 브라우저 음성만 쓴다.
   */
  const play = async () => {
    if (!enabled) return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    releaseAudioUrl();

    if (!assistantTurnId) {
      speakWithBrowser();
      return;
    }

    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERVER_TTS_TIMEOUT_MS);
    try {
      const res = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_turn_id: assistantTurnId, speech_token: resolvedSpeechToken }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { speakWithBrowser(); return; }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('audio')) {
        const buffer = await res.arrayBuffer();
        const url = URL.createObjectURL(new Blob([buffer], { type: contentType }));
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setStatus('playing');
        audio.onended = () => { setStatus('completed'); onCompletedRef.current?.(); };
        audio.onerror = () => { setStatus('error'); speakWithBrowser(); };
        await audio.play();
        return;
      }
      // JSON 폴백 신호(speech_status: 'browser_fallback') — 서버가 이미 판단한 폴백을 따른다.
      speakWithBrowser();
    } catch {
      clearTimeout(timer);
      speakWithBrowser();
    }
  };
  playRef.current = play;

  const pause = () => {
    if (status === 'paused') {
      window.speechSynthesis?.resume();
      audioRef.current?.play();
      setStatus('playing');
    } else {
      window.speechSynthesis?.pause();
      audioRef.current?.pause();
      setStatus('paused');
    }
  };

  useEffect(() => {
    const key = `${assistantTurnId ?? 'local'}:${resolvedSpeechToken ?? ''}:${text}`;
    if (!autoPlay || autoPlayedKeyRef.current === key) return;
    autoPlayedKeyRef.current = key;
    void playRef.current();
  }, [assistantTurnId, autoPlay, resolvedSpeechToken, text]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); audioRef.current?.pause(); releaseAudioUrl(); }, []);

  return <div className={`speech-controls ${compact ? 'compact' : ''}`}><span className="ai-pill">🤖 AI 생성 음성 · {status === 'playing' ? '🔊 재생 중' : status === 'loading' ? '준비 중' : status === 'paused' ? '일시정지됨' : '텍스트 먼저 제공'}</span><div><button type="button" onClick={play}>다시 듣기</button><button type="button" onClick={pause}>{status === 'paused' ? '계속' : '일시정지'}</button><button type="button" onClick={stop}>그만 듣기</button></div><button type="button" className="text-button" onClick={() => { setEnabled(!enabled); stop(); }}>{enabled ? '음성 답변 끄기' : '음성 답변 켜기'}</button></div>;
}
