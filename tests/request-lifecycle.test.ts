import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { scheduleStateFor, serviceDateFor } from '@/lib/domain/requestSchedule';
import { demoSeniorId, demoWorkerId, serviceRequests } from '@/lib/server/store';
import { POST as takeCharge } from '@/app/api/service-requests/[id]/take-charge/route';
import { POST as complete } from '@/app/api/service-requests/[id]/complete/route';
import { PATCH as legacyPatch } from '@/app/api/service-requests/[id]/route';

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const workerRequest = (path: string, body?: unknown) => new NextRequest(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'worker', 'x-test-user-id': demoWorkerId }, body: body ? JSON.stringify(body) : undefined });

describe('request schedule is independent from workflow status', () => {
  const now = new Date('2026-08-25T01:00:00Z');
  const base = { details: {}, dueAt: undefined, serviceDate: null, status: 'new' as const };

  it('derives the stored service date from the normalized desired date', () => {
    expect(serviceDateFor({ desiredDateStart: '2026-08-26', timezone: 'Asia/Seoul' })).toBe('2026-08-26');
  });

  it('classifies today, upcoming, overdue, and unscheduled in Asia/Seoul', () => {
    expect(scheduleStateFor({ ...base, serviceDate: '2026-08-25' }, now)).toBe('today');
    expect(scheduleStateFor({ ...base, serviceDate: '2026-08-26' }, now)).toBe('upcoming');
    expect(scheduleStateFor({ ...base, serviceDate: '2026-08-24' }, now)).toBe('overdue');
    expect(scheduleStateFor(base, now)).toBe('unscheduled');
  });
});

describe('worker-only completion action', () => {
  it('moves new to in_progress, then records completion only through the complete endpoint', async () => {
    const card = await serviceRequests.create({ seniorId: demoSeniorId, type: 'daily_help', summary: '완료 동작 테스트', transcript: '오늘 장보기를 도와주세요.', inputType: 'text', details: { desiredDateStart: '2026-08-25', timezone: 'Asia/Seoul' }, missingFields: [], idempotencyKey: `complete-${crypto.randomUUID()}` });
    const taken = await takeCharge(workerRequest(`/api/service-requests/${card.id}/take-charge`), context(card.id));
    expect(taken.status).toBe(200);
    expect((await taken.json()).status).toBe('in_progress');

    const done = await complete(workerRequest(`/api/service-requests/${card.id}/complete`), context(card.id));
    expect(done.status).toBe(200);
    const body = await done.json();
    expect(body.status).toBe('done');
    expect(body.completedBy).toBe(demoWorkerId);
    expect(body.completedAt).toBeTruthy();
  });

  it('rejects a direct done transition through the legacy patch route', async () => {
    const card = await serviceRequests.create({ seniorId: demoSeniorId, type: 'daily_help', summary: '직접 완료 차단', transcript: '테스트 요청', inputType: 'text', details: {}, missingFields: [], idempotencyKey: `direct-done-${crypto.randomUUID()}` });
    const request = new NextRequest(`http://localhost/api/service-requests/${card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-test-role': 'worker', 'x-test-user-id': demoWorkerId }, body: JSON.stringify({ status: 'done' }) });
    const response = await legacyPatch(request, context(card.id));
    expect(response.status).toBe(400);
  });
});
