import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const DEMO_SECRET = 'dolbom-eum-local-fixture-speech-token';

type TokenPayload = { id: string; seniorId: string; text: string; issuedAt: number };

function signingSecret(env: Record<string, string | undefined>): string {
  return env.OPENAI_API_KEY || env.SUPABASE_SECRET_KEY || DEMO_SECRET;
}

function signature(encodedPayload: string, env: Record<string, string | undefined>): string {
  return createHmac('sha256', signingSecret(env)).update(encodedPayload).digest('base64url');
}

export function createAssistantTurnToken(payload: Omit<TokenPayload, 'issuedAt'>, env: Record<string, string | undefined> = process.env): string {
  const encodedPayload = Buffer.from(JSON.stringify({ ...payload, issuedAt: Date.now() }), 'utf8').toString('base64url');
  return `${encodedPayload}.${signature(encodedPayload, env)}`;
}

export function verifyAssistantTurnToken(token: string, expected: { id: string; seniorId: string }, env: Record<string, string | undefined> = process.env): TokenPayload | null {
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra) return null;
  const expectedSignature = signature(encodedPayload, env);
  const provided = Buffer.from(providedSignature);
  const calculated = Buffer.from(expectedSignature);
  if (provided.length !== calculated.length || !timingSafeEqual(provided, calculated)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.id !== expected.id || payload.seniorId !== expected.seniorId || typeof payload.text !== 'string' || payload.text.length === 0) return null;
    if (!Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > TOKEN_TTL_MS || payload.issuedAt > Date.now() + 30_000) return null;
    return payload;
  } catch {
    return null;
  }
}
