import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function requestWithRole(path: string, role?: string) {
  const request = new NextRequest(new URL(path, 'http://localhost:3000'));
  if (role) request.cookies.set('demo-role', role);
  return request;
}

describe('role-based route guarding', () => {
  it('allows a senior-role session to view /senior', () => {
    const response = middleware(requestWithRole('/senior', 'senior'));
    expect(response.status).toBe(200);
  });

  it('redirects a family-role session away from /senior to /family', () => {
    const response = middleware(requestWithRole('/senior', 'family'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/family');
  });

  it('redirects a worker-role session away from /family to /worker', () => {
    const response = middleware(requestWithRole('/family', 'worker'));
    expect(response.headers.get('location')).toContain('/worker');
  });

  it('sends a session with no role cookie to role selection instead of rendering a protected screen', () => {
    const response = middleware(requestWithRole('/worker'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/');
  });

  it('does not block unrelated public paths', () => {
    const response = middleware(requestWithRole('/', 'senior'));
    expect(response.status).toBe(200);
  });
});
