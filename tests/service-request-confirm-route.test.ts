import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('POST /api/service-requests confirms a draft into a new persisted card', () => {
  beforeEach(() => { (globalThis as { __resetServiceRequestsForTest?: () => void }).__resetServiceRequestsForTest?.(); });

  it('creates exactly one card when the same idempotency key is sent twice', async () => {
    const { POST } = await import('@/app/api/service-requests/route');
    const body = { type: 'hospital_escort', summary: '요약', transcript: '원문', inputType: 'voice', details: {}, missingFields: [], idempotencyKey: 'confirm-key-1', confirmed: true as const };
    const req1 = new NextRequest('http://localhost:3000/api/service-requests', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res1 = await POST(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(201);

    const req2 = new NextRequest('http://localhost:3000/api/service-requests', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res2 = await POST(req2);
    const data2 = await res2.json();

    expect(data2.id).toBe(data1.id);
  });

  it('rejects a confirmation payload missing the confirmed flag', async () => {
    const { POST } = await import('@/app/api/service-requests/route');
    const body = { type: 'hospital_escort', summary: '요약', transcript: '원문', inputType: 'voice', details: {}, missingFields: [], idempotencyKey: 'confirm-key-2' };
    const req = new NextRequest('http://localhost:3000/api/service-requests', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ai/speech requires ownership of the assistant turn', () => {
  it('returns 403 when the requesting senior does not own the assistant_turn_id', async () => {
    const { POST: respond } = await import('@/app/api/ai/respond/route');
    const respondReq = new NextRequest('http://localhost:3000/api/ai/respond', { method: 'POST', body: JSON.stringify({ text: '안녕하세요', seniorId: 'spoofed-senior' }), headers: { 'Content-Type': 'application/json', 'x-test-role': 'senior', 'x-test-user-id': 'senior-owner' } });
    const respondRes = await respond(respondReq);
    const turn = await respondRes.json();

    const { POST: speech } = await import('@/app/api/ai/speech/route');
    const speechReq = new NextRequest('http://localhost:3000/api/ai/speech', { method: 'POST', body: JSON.stringify({ assistant_turn_id: turn.id, senior_id: 'senior-owner' }), headers: { 'Content-Type': 'application/json', 'x-test-role': 'senior', 'x-test-user-id': 'someone-else' } });
    const speechRes = await speech(speechReq);
    expect(speechRes.status).toBe(403);
  });

  it('allows the owning senior to fetch speech with a signed token even when route memory is not shared', async () => {
    const { POST: respond } = await import('@/app/api/ai/respond/route');
    const respondReq = new NextRequest('http://localhost:3000/api/ai/respond', { method: 'POST', body: JSON.stringify({ text: '안녕하세요' }), headers: { 'Content-Type': 'application/json', 'x-test-role': 'senior', 'x-test-user-id': 'senior-owner-2' } });
    const respondRes = await respond(respondReq);
    const turn = await respondRes.json();
    const { state } = await import('@/lib/server/store');
    state.turns.splice(0, state.turns.length);

    const { POST: speech } = await import('@/app/api/ai/speech/route');
    const speechReq = new NextRequest('http://localhost:3000/api/ai/speech', { method: 'POST', body: JSON.stringify({ assistant_turn_id: turn.id, speech_token: turn.speech_token }), headers: { 'Content-Type': 'application/json', 'x-test-role': 'senior', 'x-test-user-id': 'senior-owner-2' } });
    const speechRes = await speech(speechReq);
    expect(speechRes.status).toBe(200);
    expect(speechRes.headers.get('Cache-Control')).toContain('no-store');
  });
});
