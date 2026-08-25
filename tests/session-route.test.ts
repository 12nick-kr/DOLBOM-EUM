import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/session/[role]/route';

describe('demo session role selection', () => {
  it('sets a demo-role cookie and redirects to the matching role screen', async () => {
    const request = new NextRequest(new URL('/api/session/senior', 'http://localhost:3000'));
    const response = await GET(request, { params: Promise.resolve({ role: 'senior' }) });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/senior');
    const cookie = response.cookies.get('demo-role');
    expect(cookie?.value).toBe('senior');
  });

  it('rejects an invalid role instead of setting an arbitrary cookie value', async () => {
    const request = new NextRequest(new URL('/api/session/hacker', 'http://localhost:3000'));
    const response = await GET(request, { params: Promise.resolve({ role: 'hacker' }) });
    expect(response.status).toBe(400);
  });
});
