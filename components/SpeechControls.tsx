'use client';
import { useEffect, useState } from 'react';
import type { SpeechStatus } from '@/lib/domain/types';

export function SpeechControls({ text, compact = false }: { text: string; compact?: boolean }) {
  const [status, setStatus] = useState<SpeechStatus>('idle'); const [enabled, setEnabled] = useState(true);
  const stop = () => { window.speechSynthesis?.cancel(); setStatus('completed'); };
  const play = () => { if (!enabled) return; window.speechSynthesis?.cancel(); if (!('speechSynthesis' in window)) { setStatus('unavailable'); return; } const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ko-KR'; utterance.rate = 0.85; utterance.onstart = () => setStatus('playing'); utterance.onend = () => setStatus('completed'); utterance.onerror = () => setStatus('error'); window.speechSynthesis.speak(utterance); };
  const pause = () => { if (status === 'paused') { window.speechSynthesis.resume(); setStatus('playing'); } else { window.speechSynthesis.pause(); setStatus('paused'); } };
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return <div className={`speech-controls ${compact ? 'compact' : ''}`}><span className="ai-pill">🤖 AI 생성 음성 · {status === 'playing' ? '🔊 재생 중' : status === 'paused' ? '일시정지됨' : '텍스트 먼저 제공'}</span><div><button type="button" onClick={play}>다시 듣기</button><button type="button" onClick={pause}>{status === 'paused' ? '계속' : '일시정지'}</button><button type="button" onClick={stop}>그만 듣기</button></div><button type="button" className="text-button" onClick={() => { setEnabled(!enabled); stop(); }}>{enabled ? '음성 답변 끄기' : '음성 답변 켜기'}</button></div>;
}
