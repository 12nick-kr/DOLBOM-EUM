'use client';

/**
 * UI에서 분리된 음성 출력 엔진. 노인 화면의 "버튼 한 번으로 끝까지 자동 진행" 흐름은
 * 각 단계가 반드시 다음 단계로 이어져야 하므로, 이 모듈의 함수들은 재생에 실패하든
 * 브라우저가 지원하지 않든 **항상 resolve한다**. 호출부는 결과를 확인할 필요 없이
 * `await` 뒤에 다음 단계를 실행하면 된다.
 *
 * 서버 TTS(OpenAI)는 자격증명이 있을 때만 동작한다(lib/server/aiFactory.ts). 없으면
 * `/api/ai/speech`가 항상 browser_fallback을 주므로 실제 음성은 브라우저 speechSynthesis가 낸다.
 */

/** speechSynthesis가 onend를 누락하는 브라우저가 있어, 글자 수에 비례한 상한을 함께 건다. */
const MIN_SPEECH_TIMEOUT_MS = 4000;
const MS_PER_CHAR = 220;
/** Chrome은 voiceschanged 전에 speak()를 삼키는 경우가 있어 목록 로딩을 잠깐 기다린다. */
const VOICES_READY_TIMEOUT_MS = 1500;
const SERVER_TTS_TIMEOUT_MS = 5000;

export type SpeakOptions = {
  /** 서버 TTS를 시도할 assistant turn. 토큰과 함께 주어질 때만 서버 경로를 탄다. */
  assistantTurnId?: string;
  speechToken?: string;
};

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let beepContext: AudioContext | null = null;

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function releaseActiveAudio() {
  if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
  activeAudio = null;
}

/** 진행 중인 모든 음성 재생을 즉시 멈춘다 (긴급 화면 전환·취소 시). */
export function cancelSpeech(): void {
  if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
  activeAudio?.pause();
  releaseActiveAudio();
}

/**
 * 브라우저가 보이스 목록을 비동기로 채우는 동안 기다린다. 목록이 이미 있거나
 * 상한 시간이 지나면 즉시 진행한다 — 기다림 자체가 흐름을 막아서는 안 된다.
 */
function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!hasSpeechSynthesis()) { resolve([]); return; }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) { resolve(existing); return; }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', finish);
    setTimeout(finish, VOICES_READY_TIMEOUT_MS);
  });
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => voice.lang === 'ko-KR') ?? voices.find((voice) => voice.lang?.startsWith('ko'));
}

/** 브라우저 speechSynthesis로 읽어 준다. 미지원·오류·onend 누락 모두 resolve로 수렴한다. */
async function speakWithBrowser(text: string): Promise<void> {
  if (!hasSpeechSynthesis()) return;
  const voices = await waitForVoices();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      const voice = pickKoreanVoice(voices);
      if (voice) utterance.voice = voice;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      setTimeout(finish, Math.max(MIN_SPEECH_TIMEOUT_MS, text.length * MS_PER_CHAR));
    } catch {
      finish();
    }
  });
}

/** 서버 TTS 오디오를 재생한다. 실패하면 false를 반환해 호출부가 브라우저 음성으로 넘어가게 한다. */
async function speakWithServer(text: string, opts: SpeakOptions): Promise<boolean> {
  if (!opts.assistantTurnId || typeof fetch === 'undefined') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TTS_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ai/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant_turn_id: opts.assistantTurnId, speech_token: opts.speechToken }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('audio')) return false;
    const buffer = await res.arrayBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: contentType }));
    activeObjectUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; releaseActiveAudio(); resolve(); } };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
      setTimeout(finish, Math.max(MIN_SPEECH_TIMEOUT_MS, text.length * MS_PER_CHAR));
    });
    return true;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * 문장을 소리로 읽어 준다. 서버 TTS가 가능하면 먼저 쓰고, 아니면 브라우저 음성으로 낸다.
 * 어떤 경우에도 예외를 던지지 않고 resolve하므로 자동 진행 체인이 끊기지 않는다.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text.trim()) return;
  const playedByServer = await speakWithServer(text, opts);
  if (playedByServer) return;
  await speakWithBrowser(text);
}

/**
 * 녹음 시작을 알리는 짧은 부저음. speechSynthesis.cancel()의 영향을 받지 않도록
 * Web Audio로 직접 만들고, 무음 감지용 AudioContext와 분리된 자체 컨텍스트를 쓴다.
 */
export async function beep(): Promise<void> {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!beepContext || beepContext.state === 'closed') beepContext = new AudioContextClass();
    if (beepContext.state === 'suspended') await beepContext.resume();
    const context = beepContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    // 딸깍거림을 막기 위해 짧게 올렸다 내린다.
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      oscillator.onended = finish;
      setTimeout(finish, 400);
    });
  } catch {
    // 오디오를 낼 수 없는 환경에서도 녹음 단계로는 계속 진행한다.
  }
}
