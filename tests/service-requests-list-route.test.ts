import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { demoSeniorId } from '@/lib/server/store';

function reqWithRole(role: string) {
  const request = new NextRequest('http://localhost:3000/api/service-requests');
  request.cookies.set('demo-role', role);
  return request;
}

describe('GET /api/service-requests scopes results by role (PRD §7.4/§11.4)', () => {
  it('returns the senior their own cards including transcript', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const res = await GET(reqWithRole('senior'));
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].transcript).toBeTruthy();
  });

  it('returns the assigned worker cards for their senior set', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const res = await GET(reqWithRole('worker'));
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.every((r: { seniorId: string }) => r.seniorId === demoSeniorId)).toBe(true);
  });

  it('redacts transcript for family without explicit transcript consent', async () => {
    const { GET } = await import('@/app/api/service-requests/route');
    const res = await GET(reqWithRole('family'));
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) expect(body.data[0].transcript).toBeUndefined();
  });
});
