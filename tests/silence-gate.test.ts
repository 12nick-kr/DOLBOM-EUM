import { describe, expect, it } from 'vitest';
import { createSilenceGate } from '@/lib/client/silenceGate';

describe('voice silence gate', () => {
  it('stops only after speech followed by three continuous seconds of silence', () => {
    const gate = createSilenceGate({ silenceDurationMs: 3000, noSpeechTimeoutMs: 10_000, calibrationMs: 0 });
    expect(gate.observe(0.08, 100)).toBe('speech_started');
    expect(gate.observe(0.001, 1000)).toBe('continue');
    expect(gate.observe(0.001, 3999)).toBe('continue');
    expect(gate.observe(0.001, 4000)).toBe('silence_complete');
  });

  it('resets the silence clock when the senior resumes speaking', () => {
    const gate = createSilenceGate({ silenceDurationMs: 3000, noSpeechTimeoutMs: 10_000, calibrationMs: 0 });
    gate.observe(0.08, 0);
    gate.observe(0.001, 500);
    gate.observe(0.08, 2500);
    expect(gate.observe(0.001, 3000)).toBe('continue');
    expect(gate.observe(0.001, 6000)).toBe('silence_complete');
  });

  it('uses a separate timeout when no speech ever starts', () => {
    const gate = createSilenceGate({ silenceDurationMs: 3000, noSpeechTimeoutMs: 10_000, calibrationMs: 0 });
    expect(gate.observe(0.001, 9999)).toBe('continue');
    expect(gate.observe(0.001, 10_000)).toBe('no_speech');
  });
});
