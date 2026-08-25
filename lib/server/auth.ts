import type { NextRequest } from 'next/server';
import { demoSessionCookie, verifyDemoSession } from '@/lib/auth/sessionToken';
import { roleSchema, type Role } from '@/lib/domain/types';
import { demoFamilyId, demoSeniorId, demoWorkerId } from './store';
import { createSupabaseRequestClient, hasSupabaseAuthEnvironment } from './supabaseAuth';

export type AuthActor = { id: string; role: Role; displayName: string };

function actorForTest(request: NextRequest): AuthActor | null {
  if (process.env.NODE_ENV !== 'test') return null;
  const candidate = request.headers.get('x-test-role') ?? request.headers.get('x-demo-role') ?? request.cookies.get('demo-role')?.value ?? 'senior';
  const role = roleSchema.safeParse(candidate);
  if (!role.success) return null;
  const defaultId = role.data === 'senior' ? demoSeniorId : role.data === 'family' ? demoFamilyId : demoWorkerId;
  return { id: request.headers.get('x-test-user-id') ?? defaultId, role: role.data, displayName: '테스트 사용자' };
}

export async function authenticatedActor(request: NextRequest): Promise<AuthActor | null> {
  const testActor = actorForTest(request);
  if (testActor) return testActor;

  if (hasSupabaseAuthEnvironment()) {
    const client = createSupabaseRequestClient(request);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    const role = roleSchema.safeParse(user.app_metadata.role);
    if (!role.success) return null;
    const { data: profile } = await client.from('profiles').select('display_name, account_status').eq('id', user.id).maybeSingle();
    if (profile?.account_status === 'suspended') return null;
    return { id: user.id, role: role.data, displayName: profile?.display_name ?? '돌봄이음 사용자' };
  }

  const session = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  return session ? { id: session.sub, role: session.role, displayName: session.displayName } : null;
}

export async function requireActor(request: NextRequest): Promise<AuthActor> {
  const actor = await authenticatedActor(request);
  if (!actor) throw new Error('AUTH_REQUIRED');
  return actor;
}
