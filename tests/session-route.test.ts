import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';

describe('phone-shaped login id authentication', () => {
  it('creates an active role account and a signed session without SMS', async () => {
    const request = new NextRequest(new URL('/api/auth/signup', 'http://localhost:3000'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: '김순자', loginId: '010-0000-9101', pin: '123456', pinConfirm: '123456', role: 'senior' }) });
    const response = await signup(request);
    expect(response.status).toBe(201);
    expect((await response.json()).redirectTo).toBe('/senior');
    expect(response.cookies.get('dolbom-demo-session')?.value).toBeTruthy();
  });

  it('rejects a phone-shaped id outside the reserved demo range', async () => {
    const request = new NextRequest(new URL('/api/auth/signup', 'http://localhost:3000'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: '테스트', loginId: '010-1234-5678', pin: '123456', pinConfirm: '123456', role: 'senior' }) });
    const response = await signup(request);
    expect(response.status).toBe(400);
  });

  it('signs in with the login id and six-digit PIN', async () => {
    const request = new NextRequest(new URL('/api/auth/login', 'http://localhost:3000'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: '010-0000-9101', pin: '123456' }) });
    const response = await login(request);
    expect(response.status).toBe(200);
    expect((await response.json()).redirectTo).toBe('/senior');
  });
});
