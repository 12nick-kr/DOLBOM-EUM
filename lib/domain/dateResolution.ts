import type { RequestDetails } from './types';

type CalendarDate = { year: number; month: number; day: number };

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const weekdayIndex: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function calendarInSeoul(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function asUtcDate(value: CalendarDate): Date {
  return new Date(Date.UTC(value.year, value.month - 1, value.day));
}

function addDays(value: CalendarDate, days: number): CalendarDate {
  const date = asUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function formatDate(value: CalendarDate): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function isValidDate(value: CalendarDate): boolean {
  const date = asUtcDate(value);
  return date.getUTCFullYear() === value.year && date.getUTCMonth() + 1 === value.month && date.getUTCDate() === value.day;
}

function timeWindow(text: string): RequestDetails['timeWindow'] {
  if (/새벽/.test(text)) return 'dawn';
  if (/아침|오전/.test(text)) return 'morning';
  if (/점심/.test(text)) return 'midday';
  if (/오후/.test(text)) return 'afternoon';
  if (/저녁|밤/.test(text)) return 'evening';
  return undefined;
}

function resolvedDetails(start: CalendarDate, end: CalendarDate, expression: string, text: string): RequestDetails {
  const desiredDateStart = formatDate(start);
  const desiredDateEnd = formatDate(end);
  return {
    desiredAt: desiredDateStart,
    desiredDateStart,
    desiredDateEnd,
    timeWindow: timeWindow(text),
    originalDateExpression: expression.trim(),
    timezone: SEOUL_TIME_ZONE,
    dateResolution: desiredDateStart === desiredDateEnd ? 'resolved' : 'range',
    dateConfidence: 1,
  };
}

/**
 * 한국어 상대 날짜를 서버 기준(Asia/Seoul) 달력 날짜로 결정한다. 모델 결과를 신뢰해 날짜를
 * 만들어내지 않고, 이 함수가 이해한 표현만 구조화한다. 이해하지 못하면 빈 객체를 반환한다.
 */
export function resolveDesiredDate(text: string, now: Date = new Date()): RequestDetails {
  const today = calendarInSeoul(now);

  const relative = text.match(/(오늘|내일|모레)/);
  if (relative) {
    const offset = relative[1] === '오늘' ? 0 : relative[1] === '내일' ? 1 : 2;
    const date = addDays(today, offset);
    return resolvedDetails(date, date, relative[1], text);
  }

  const weekDay = text.match(/(이번|다음)\s*주\s*([월화수목금토일])요일/);
  if (weekDay) {
    const currentWeekday = asUtcDate(today).getUTCDay();
    const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
    const weekOffset = weekDay[1] === '다음' ? 7 : 0;
    const targetOffset = weekdayIndex[weekDay[2]] === 0 ? 6 : weekdayIndex[weekDay[2]] - 1;
    const date = addDays(today, mondayOffset + weekOffset + targetOffset);
    return resolvedDetails(date, date, weekDay[0], text);
  }

  const nextWeekday = text.match(/다음\s*([월화수목금토일])요일/);
  if (nextWeekday) {
    const currentWeekday = asUtcDate(today).getUTCDay();
    let offset = weekdayIndex[nextWeekday[1]] - currentWeekday;
    if (offset <= 0) offset += 7;
    const date = addDays(today, offset);
    return resolvedDetails(date, date, nextWeekday[0], text);
  }

  const weekend = text.match(/(이번|다음)\s*주말/);
  if (weekend) {
    const currentWeekday = asUtcDate(today).getUTCDay();
    const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
    const weekOffset = weekend[1] === '다음' ? 7 : 0;
    const saturday = addDays(today, mondayOffset + weekOffset + 5);
    return resolvedDetails(saturday, addDays(saturday, 1), weekend[0], text);
  }

  const broadWeek = text.match(/(이번|다음)\s*주(?:\s*중)?/);
  if (broadWeek) {
    const currentWeekday = asUtcDate(today).getUTCDay();
    const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
    const weekOffset = broadWeek[1] === '다음' ? 7 : 0;
    const monday = addDays(today, mondayOffset + weekOffset);
    return resolvedDetails(monday, addDays(monday, 6), broadWeek[0], text);
  }

  const explicit = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (explicit) {
    const month = Number(explicit[1]);
    const day = Number(explicit[2]);
    let candidate = { year: today.year, month, day };
    if (!isValidDate(candidate)) return {};
    if (formatDate(candidate) < formatDate(today)) candidate = { ...candidate, year: today.year + 1 };
    if (!isValidDate(candidate)) return {};
    return resolvedDetails(candidate, candidate, explicit[0], text);
  }

  return {};
}

export function flexibleDesiredDate(expression = '담당자와 일정 협의'): RequestDetails {
  return {
    originalDateExpression: expression,
    timezone: SEOUL_TIME_ZONE,
    dateResolution: 'needs_coordination',
    dateConfidence: 0,
  };
}

export function formatDesiredDate(details: RequestDetails): string | undefined {
  if (details.dateResolution === 'needs_coordination') return '담당자와 일정 협의';
  if (!details.desiredDateStart) return details.desiredAt;
  const humanDate = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[2])}월 ${Number(match[3])}일` : value;
  };
  const range = details.desiredDateEnd && details.desiredDateEnd !== details.desiredDateStart
    ? `${humanDate(details.desiredDateStart)} ~ ${humanDate(details.desiredDateEnd)}`
    : humanDate(details.desiredDateStart);
  const timeLabels: Record<NonNullable<RequestDetails['timeWindow']>, string> = {
    dawn: '새벽', morning: '오전', midday: '점심', afternoon: '오후', evening: '저녁', flexible: '시간 협의',
  };
  return details.timeWindow ? `${range} ${timeLabels[details.timeWindow]}` : range;
}
