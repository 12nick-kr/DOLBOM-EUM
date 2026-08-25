import { roleSchema, type Role } from '@/lib/domain/types';

export const demoSessionCookie = 'dolbom-demo-session';

export type DemoSession = {
  sub: string;
  role: Role;
  displayName: string;
  exp: number;
};

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function secretFor(env: Record<string, string | undefined> = process.env): string {
  const configured = env.DEMO_AUTH_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') throw new Error('DEMO_AUTH_SECRET이 필요합니다.');
  return 'dolbom-eum-local-demo-secret-change-before-deploy';
}

async function hmac(payload: string, env?: Record<string, string | undefined>): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretFor(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

export async function signDemoSession(session: Omit<DemoSession, 'exp'>, env?: Record<string, string | undefined>): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 }));
  return `${payload}.${base64UrlEncode(await hmac(payload, env))}`;
}

export async function verifyDemoSession(token: string | undefined, env?: Record<string, string | undefined>): Promise<DemoSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = await hmac(payload, env);
  const actual = base64UrlDecode(signature);
  if (actual.length !== expected.length) return null;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index];
  if (mismatch !== 0) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Partial<DemoSession>;
    const role = roleSchema.safeParse(decoded.role);
    if (!role.success || typeof decoded.sub !== 'string' || typeof decoded.displayName !== 'string' || typeof decoded.exp !== 'number' || decoded.exp <= Date.now() / 1000) return null;
    return { sub: decoded.sub, role: role.data, displayName: decoded.displayName, exp: decoded.exp };
  } catch {
    return null;
  }
}
