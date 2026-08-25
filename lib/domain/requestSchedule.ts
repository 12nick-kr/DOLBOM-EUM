import type { RequestDetails, ServiceRequest } from './types';

export type RequestScheduleState = 'today' | 'upcoming' | 'overdue' | 'unscheduled';

export const scheduleStateLabel: Record<RequestScheduleState, string> = {
  today: '오늘',
  upcoming: '예정',
  overdue: '기한 지남',
  unscheduled: '일정 협의',
};

export function seoulDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function serviceDateFor(details: RequestDetails, dueAt?: string): string | null {
  if (details.desiredDateStart && /^\d{4}-\d{2}-\d{2}$/.test(details.desiredDateStart)) return details.desiredDateStart;
  if (details.desiredAt && /^\d{4}-\d{2}-\d{2}/.test(details.desiredAt)) return details.desiredAt.slice(0, 10);
  if (!dueAt) return null;
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : seoulDateKey(parsed);
}

export function scheduleStateFor(request: Pick<ServiceRequest, 'serviceDate' | 'details' | 'dueAt' | 'status'>, now: Date = new Date()): RequestScheduleState {
  const serviceDate = request.serviceDate ?? serviceDateFor(request.details, request.dueAt);
  if (!serviceDate) return 'unscheduled';
  const today = seoulDateKey(now);
  if (serviceDate === today) return 'today';
  if (serviceDate > today) return 'upcoming';
  return 'overdue';
}
