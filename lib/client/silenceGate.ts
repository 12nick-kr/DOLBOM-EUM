export type SilenceGateResult = 'continue' | 'speech_started' | 'silence_complete' | 'no_speech';

/** Web Audio의 RMS 표본을 받아 발화 시작 뒤 연속 무음과 처음부터의 무발화를 구분한다. */
export function createSilenceGate(options: { silenceDurationMs: number; noSpeechTimeoutMs: number; calibrationMs?: number }) {
  const calibrationMs = options.calibrationMs ?? 500;
  let noiseFloor = 0.006;
  let speechStarted = false;
  let silenceStartedAt: number | null = null;

  return {
    observe(rms: number, elapsedMs: number): SilenceGateResult {
      if (elapsedMs < calibrationMs && !speechStarted) noiseFloor = noiseFloor * 0.8 + rms * 0.2;
      const speechThreshold = Math.max(0.018, noiseFloor * 2.8);
      if (rms >= speechThreshold) {
        const firstSpeech = !speechStarted;
        speechStarted = true;
        silenceStartedAt = null;
        return firstSpeech ? 'speech_started' : 'continue';
      }
      if (speechStarted) {
        silenceStartedAt ??= elapsedMs;
        return elapsedMs - silenceStartedAt >= options.silenceDurationMs ? 'silence_complete' : 'continue';
      }
      return elapsedMs >= options.noSpeechTimeoutMs ? 'no_speech' : 'continue';
    },
  };
}
