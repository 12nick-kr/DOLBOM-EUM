import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

describe('GET /api/care-cards', () => {
  it('returns the shared card feed and removes transcript for family', async () => {
    const { GET } = await import('@/app/api/care-cards/route');
    const response = await GET(new NextRequest('http://localhost/api/care-cards?limit=10', { headers: { 'x-demo-role': 'family' } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.every((card: Record<string, unknown>) => !('transcript' in card))).toBe(true);
  });

  it('rejects an invalid cursor instead of returning an ambiguous page', async () => {
    const { GET } = await import('@/app/api/care-cards/route');
    const response = await GET(new NextRequest('http://localhost/api/care-cards?cursor=not-a-date'));
    expect(response.status).toBe(400);
  });
});
