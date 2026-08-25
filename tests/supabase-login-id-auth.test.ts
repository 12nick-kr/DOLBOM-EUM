import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  insertProfile: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('@/lib/server/supabaseAuth', () => ({
  hasSupabaseAuthEnvironment: () => true,
  createSupabaseAdminClient: () => ({
    auth: { admin: { createUser: authMocks.createUser, deleteUser: authMocks.deleteUser } },
    from: () => ({ insert: authMocks.insertProfile }),
  }),
  createSupabaseResponseClient: () => ({ auth: { signInWithPassword: authMocks.signInWithPassword } }),
}));

describe('Supabase login-id authentication never invokes the Phone provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.createUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } }, error: null });
    authMocks.insertProfile.mockResolvedValue({ error: null });
    authMocks.signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: { role: 'senior' } } }, error: null });
    authMocks.deleteUser.mockResolvedValue({ error: null });
  });

  it('creates an auto-confirmed internal email account and stores login_id', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '김순자', loginId: '010-0000-1234', pin: '123456', pinConfirm: '123456', role: 'senior' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(authMocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: '01000001234@id.dolbomeum.invalid', password: '123456', email_confirm: true,
    }));
    expect(authMocks.createUser.mock.calls[0]?.[0]).not.toHaveProperty('phone');
    expect(authMocks.createUser.mock.calls[0]?.[0]).not.toHaveProperty('phone_confirm');
    expect(authMocks.insertProfile).toHaveBeenCalledWith(expect.objectContaining({ login_id: '01000001234' }));
  });

  it('signs in with the internal email rather than a phone credential', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: '010-0000-1234', pin: '123456' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({ email: '01000001234@id.dolbomeum.invalid', password: '123456' });
    expect(authMocks.signInWithPassword.mock.calls[0]?.[0]).not.toHaveProperty('phone');
  });
});
