import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function requestWithRole(path: string, role?: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), { headers: role ? { 'x-test-role': role } : undefined });
}

describe('role-based route guarding', () => {
  it('allows a senior-role session to view /senior', async () => {
    const response = await middleware(requestWithRole('/senior', 'senior'));
    expect(response.status).toBe(200);
  });

  it('redirects a family-role session away from /senior to /family', async () => {
    const response = await middleware(requestWithRole('/senior', 'family'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/family');
  });

  it('redirects a worker-role session away from /family to /worker', async () => {
    const response = await middleware(requestWithRole('/family', 'worker'));
    expect(response.headers.get('location')).toContain('/worker');
  });

  it('sends a session with no role cookie to login instead of rendering a protected screen', async () => {
    const response = await middleware(requestWithRole('/worker'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('does not block unrelated public paths', async () => {
    const response = await middleware(requestWithRole('/', 'senior'));
    expect(response.status).toBe(200);
  });
});
