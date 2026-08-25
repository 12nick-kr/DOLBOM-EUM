import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

describe('POST /api/senior-inputs', () => {
  beforeEach(() => {
    (globalThis as { __resetSeniorInputsForTest?: () => void }).__resetSeniorInputsForTest?.();
    (globalThis as { __resetServiceRequestsForTest?: () => void }).__resetServiceRequestsForTest?.();
  });

  it('persists one confirmed input event and one linked request card', async () => {
    const { POST } = await import('@/app/api/senior-inputs/route');
    const body = {
      transcript: '다음 주 화요일 충남대병원에 같이 가 주세요.', inputType: 'voice', confirmed: true,
      idempotencyKey: 'senior-confirm-1',
      request: {
        type: 'hospital_escort', summary: '충남대병원 동행 요청',
        details: { destination: '충남대학교병원', desiredAt: '다음 주 화요일' }, missingFields: [],
      },
    };
    const response = await POST(new NextRequest('http://localhost/api/senior-inputs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.event.source).toBe('voice');
    expect(result.event.serviceRequestId).toBe(result.card.id);
    expect(result.card.sourceEventId).toBe(result.event.id);
  });

  it('returns the same event and card for a repeated idempotency key', async () => {
    const { POST } = await import('@/app/api/senior-inputs/route');
    const body = {
      transcript: '장보기를 도와주세요.', inputType: 'text', confirmed: true,
      idempotencyKey: 'senior-confirm-repeat',
      request: { type: 'daily_help', summary: '장보기 도움 요청', details: {}, missingFields: [] },
    };
    const makeRequest = () => new NextRequest('http://localhost/api/senior-inputs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const first = await (await POST(makeRequest())).json();
    const second = await (await POST(makeRequest())).json();
    expect(second.event.id).toBe(first.event.id);
    expect(second.card.id).toBe(first.card.id);
  });

  it('rejects unconfirmed input and ignores a client-supplied senior id', async () => {
    const { POST } = await import('@/app/api/senior-inputs/route');
    const response = await POST(new NextRequest('http://localhost/api/senior-inputs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: '도와주세요', inputType: 'text', idempotencyKey: 'bad', seniorId: 'attacker' }),
    }));
    expect(response.status).toBe(400);
  });
});
