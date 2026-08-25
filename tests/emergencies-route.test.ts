import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

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
  it('records actor, action, and timestamp for a family acknowledgement', async () => {
    const { PATCH } = await import('@/app/api/emergencies/[id]/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies/emergency-demo-001', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-demo-role': 'family' }, body: JSON.stringify({ actor: 'family', status: 'family_acknowledged', action: '가족이 확인했어요.' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'emergency-demo-001' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('family_acknowledged');
    const lastAction = body.actions[body.actions.length - 1];
    expect(lastAction.actor).toBe('family');
    expect(lastAction.action).toBe('가족이 확인했어요.');
    expect(lastAction.at).toBeTruthy();
  });

  it('returns 404 for an unknown emergency id instead of silently succeeding', async () => {
    const { PATCH } = await import('@/app/api/emergencies/[id]/route');
    const req = new NextRequest('http://localhost:3000/api/emergencies/does-not-exist', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-demo-role': 'worker' }, body: JSON.stringify({ actor: 'worker', status: 'worker_followup', action: 'x' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });
});
