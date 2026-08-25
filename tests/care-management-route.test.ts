import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createDemoAccount, type DemoAccount } from '@/lib/server/accountStore';
import { GET as searchAccount } from '@/app/api/care-management/accounts/route';
import { GET as getGroups } from '@/app/api/care-management/groups/route';
import { POST as linkRelationship } from '@/app/api/care-management/relationships/route';

let senior: DemoAccount;
let family: DemoAccount;
let worker: DemoAccount;

function request(path: string, role: 'senior' | 'family' | 'worker', id: string, init: { method?: string; body?: BodyInit } = {}) {
  return new NextRequest(`http://localhost${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'x-test-role': role, 'x-test-user-id': id } });
}

describe('care group management', () => {
  beforeAll(async () => {
    senior = await createDemoAccount({ loginId: '01000009201', pin: '123456', displayName: '연결노인', role: 'senior' });
    family = await createDemoAccount({ loginId: '01000009202', pin: '123456', displayName: '연결가족', role: 'family' });
    worker = await createDemoAccount({ loginId: '01000009203', pin: '123456', displayName: '연결복지사', role: 'worker' });
  });

  it('finds an existing synthetic account only by its exact login id', async () => {
    const response = await searchAccount(request('/api/care-management/accounts?loginId=010-0000-9201', 'worker', worker.id));
    expect(response.status).toBe(200);
    expect((await response.json()).profile).toMatchObject({ id: senior.id, role: 'senior' });
  });

  it('links a worker, then a family member into one senior-centered group', async () => {
    const workerLink = await linkRelationship(request('/api/care-management/relationships', 'worker', worker.id, { method: 'POST', body: JSON.stringify({ relationshipType: 'worker', seniorId: senior.id }) }));
    expect(workerLink.status).toBe(201);
    const familyLink = await linkRelationship(request('/api/care-management/relationships', 'worker', worker.id, { method: 'POST', body: JSON.stringify({ relationshipType: 'family', seniorId: senior.id, memberId: family.id }) }));
    expect(familyLink.status).toBe(201);

    const groups = await getGroups(request('/api/care-management/groups', 'worker', worker.id));
    const body = await groups.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].senior.id).toBe(senior.id);
    expect(body.data[0].family[0].id).toBe(family.id);
  });

  it('rejects relationship management from a family account', async () => {
    const response = await linkRelationship(request('/api/care-management/relationships', 'family', family.id, { method: 'POST', body: JSON.stringify({ relationshipType: 'worker', seniorId: senior.id }) }));
    expect(response.status).toBe(403);
  });
});
