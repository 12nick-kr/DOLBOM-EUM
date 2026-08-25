import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { demoSeniorId, demoWorkerId, emergencyEvents, seniorInputs } from '@/lib/server/store';

describe('POST /api/emergencies requires explicit confirmation (PRD §10.3 고위험 등급)', () => {
  it('rejects creation without confirmed: true', async () => {
    const { POST } = await import('@/app/api/emergencies/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utterance: '가슴이 아파요', location: '대전' }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates an emergency event with an audited first action, never claiming a real dispatch', async () => {
    const { POST } = await import('@/app/api/emergencies/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utterance: '가슴이 아파요', location: '대전', confirmed: true }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.actions.length).toBeGreaterThan(0);
    expect(body.actions[0].actor).toBeTruthy();
    expect(body.actions[0].at).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/신고\s*완료/);
    expect(body.status).not.toBe('reported');
  });
});

describe('PATCH /api/emergencies/:id appends an audited action for every status change (FR-03)', () => {
  it('allows the owning senior to close an active emergency without deleting its audit history', async () => {
    const { PATCH } = await import('@/app/api/emergencies/[id]/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies/emergency-demo-001', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-demo-role': 'senior' }, body: JSON.stringify({ status: 'closed', action: '어르신이 긴급 상황을 종료했어요.', closeReason: 'senior_cancelled' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'emergency-demo-001' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('closed');
    expect(body.actions.at(-1)).toMatchObject({ actor: 'senior', action: '어르신이 긴급 상황을 종료했어요.' });
  });

  it('keeps family accounts read-only for emergency events', async () => {
    const { PATCH } = await import('@/app/api/emergencies/[id]/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies/emergency-demo-001', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-demo-role': 'family' }, body: JSON.stringify({ actor: 'family', status: 'family_acknowledged', action: '가족이 확인했어요.' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'emergency-demo-001' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown emergency id instead of silently succeeding', async () => {
    const { PATCH } = await import('@/app/api/emergencies/[id]/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies/does-not-exist', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-demo-role': 'worker' }, body: JSON.stringify({ actor: 'worker', status: 'worker_followup', action: 'x' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/emergencies/:id removes the linked emergency JSON', () => {
  it('allows only the assigned worker and deletes both records', async () => {
    const source = await seniorInputs.create({ seniorId: demoSeniorId, source: 'voice', transcript: '숨을 쉴 수 없어요.', category: 'emergency', urgency: 'emergency', summary: '호흡 곤란 긴급 요청', visibility: { family: 'summary_only', worker: 'full' }, idempotencyKey: `delete-emergency-${crypto.randomUUID()}` });
    const emergency = await emergencyEvents.create({ seniorId: demoSeniorId, utterance: source.transcript, location: '대전광역시 중구' });
    await seniorInputs.attachEmergency(source.id, emergency.id);
    const { DELETE } = await import('@/app/api/emergencies/[id]/route');
    const request = new NextRequest(`http://localhost/api/emergencies/${emergency.id}`, { method: 'DELETE', headers: { 'x-test-role': 'worker', 'x-test-user-id': demoWorkerId } });
    const response = await DELETE(request, { params: Promise.resolve({ id: emergency.id }) });
    expect(response.status).toBe(200);
    expect(await emergencyEvents.get(emergency.id)).toBeUndefined();
    expect(await seniorInputs.get(source.id)).toBeUndefined();
  });

  it('rejects hard delete from a family account', async () => {
    const emergency = await emergencyEvents.create({ seniorId: demoSeniorId, utterance: '긴급 테스트', location: '대전' });
    const { DELETE } = await import('@/app/api/emergencies/[id]/route');
    const request = new NextRequest(`http://localhost/api/emergencies/${emergency.id}`, { method: 'DELETE', headers: { 'x-test-role': 'family' } });
    const response = await DELETE(request, { params: Promise.resolve({ id: emergency.id }) });
    expect(response.status).toBe(403);
    expect(await emergencyEvents.get(emergency.id)).toBeDefined();
  });
});
