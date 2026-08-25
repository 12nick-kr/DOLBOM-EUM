import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

function patchRequest(id: string, role: string, body: unknown) {
  const request = new NextRequest(`http://localhost:3000/api/service-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  request.cookies.set('demo-role', role);
  return request;
}

function deleteRequest(id: string, role: string) {
  const request = new NextRequest(`http://localhost:3000/api/service-requests/${id}`, { method: 'DELETE' });
  request.cookies.set('demo-role', role);
  return request;
}

/**
 * PRD §7.4 "상태 변경은 반드시 서버에서 권한을 재검증한다. UI에서 버튼을 숨긴 것만으로 권한
 * 통제를 대신하지 않는다." — PATCH가 클라이언트가 보낸 임의의 assigneeId를 그대로 신뢰하면
 * 아무 요청이나 다른 사람의 워커 ID를 자칭해 담당자로 등록할 수 있다. 서버는 반드시 인증된
 * 행위자(demoActor)의 id만 assignee로 써야 한다.
 */
describe('PATCH /api/service-requests/:id derives assignee from the authenticated actor, not the client body', () => {
  it('rejects a non-worker actor attempting to transition a request', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const listRes = await GET(patchRequest('', 'senior', {}));
    const list = (await listRes.json()).data as { id: string }[];
    const target = list[0];

    const { PATCH } = await import('@/app/api/service-requests/[id]/route');
    const res = await PATCH(patchRequest(target.id, 'senior', { status: 'in_progress', assigneeId: 'someone-else' }), { params: Promise.resolve({ id: target.id }) });
    expect(res.status).toBe(403);
  });

  it('ignores a client-supplied assigneeId and assigns the authenticated worker instead', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const listRes = await GET(patchRequest('', 'worker', {}));
    const list = (await listRes.json()).data as { id: string; status: string }[];
    const target = list.find((row) => row.status === 'new');
    expect(target).toBeDefined();

    const { PATCH } = await import('@/app/api/service-requests/[id]/route');
    const res = await PATCH(
      patchRequest(target!.id, 'worker', { status: 'in_progress', assigneeId: 'attacker-claimed-id' }),
      { params: Promise.resolve({ id: target!.id }) },
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.assigneeId).not.toBe('attacker-claimed-id');
  });
});

describe('DELETE /api/service-requests/:id hard-deletes a worker-visible request', () => {
  it('rejects non-worker deletion and removes the row for an assigned worker', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const listRes = await GET(patchRequest('', 'worker', {}));
    const list = (await listRes.json()).data as { id: string }[];
    const target = list[0];
    const route = await import('@/app/api/service-requests/[id]/route');

    const denied = await route.DELETE(deleteRequest(target.id, 'family'), { params: Promise.resolve({ id: target.id }) });
    expect(denied.status).toBe(403);

    const deleted = await route.DELETE(deleteRequest(target.id, 'worker'), { params: Promise.resolve({ id: target.id }) });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({ deleted: true, id: target.id });
  });
});
