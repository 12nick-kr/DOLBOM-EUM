import { describe, expect, it } from 'vitest';
import { resolveDesiredDate } from '@/lib/domain/dateResolution';

const anchor = new Date('2026-08-25T01:00:00.000Z'); // 2026-08-25 10:00 Asia/Seoul (화요일)

describe('Korean desired-date resolution anchored to Asia/Seoul', () => {
  it.each([
    ['오늘 오전에 병원에 가요', '2026-08-25', 'morning'],
    ['내일 오후에 와 주세요', '2026-08-26', 'afternoon'],
    ['모레 장보기를 도와주세요', '2026-08-27', undefined],
    ['다음 주 월요일 병원에 가요', '2026-08-31', undefined],
  ])('resolves %s without allowing the model to invent a date', (text, date, timeWindow) => {
    const result = resolveDesiredDate(text, anchor);
    expect(result.desiredDateStart).toBe(date);
    expect(result.desiredDateEnd).toBe(date);
    expect(result.timeWindow).toBe(timeWindow);
    expect(result.dateResolution).toBe('resolved');
  });

  it('stores a broad relative expression as a range instead of fake precision', () => {
    const result = resolveDesiredDate('다음 주 중에 병원에 가고 싶어요', anchor);
    expect(result.desiredDateStart).toBe('2026-08-31');
    expect(result.desiredDateEnd).toBe('2026-09-06');
    expect(result.dateResolution).toBe('range');
  });

  it('rolls a month/day expression into the next year when this year has already passed', () => {
    const result = resolveDesiredDate('1월 2일에 도와주세요', anchor);
    expect(result.desiredDateStart).toBe('2027-01-02');
  });

  it('does not fabricate a date when no expression exists', () => {
    expect(resolveDesiredDate('병원에 같이 가 주세요', anchor)).toEqual({});
  });
});
