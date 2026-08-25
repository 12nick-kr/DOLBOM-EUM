import { describe, expect, it } from 'vitest';
import { classifyUrgency, detectSafetyRisk } from '@/lib/domain/urgency';

describe('request safety triage', () => {
  it.each([
    '못 일어나겠어 지금',
    '넘어졌는데 일어날 수가 없어요',
    '갑자기 쓰러졌어요',
  ])('routes %s to emergency before AI classification', (text) => {
    expect(detectSafetyRisk(text).level).toBe('emergency');
    expect(classifyUrgency(text).urgency).toBe('emergency');
  });

  it.each([
    '지금은 일어나지 못하는 상태가 아니에요',
    '어제는 가슴이 아팠는데 지금은 괜찮아요',
  ])('does not over-report a negated or resolved phrase: %s', (text) => {
    expect(detectSafetyRisk(text).level).not.toBe('emergency');
  });

  it.each([
    '계속 어지러워요',
    '약을 두 번 먹은 것 같아요',
  ])('marks %s for attention', (text) => {
    expect(detectSafetyRisk(text).level).toBe('attention');
  });
});
