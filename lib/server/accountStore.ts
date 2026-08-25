import type { Role } from '@/lib/domain/types';

export type DemoAccount = {
  id: string;
  loginId: string;
  displayName: string;
  role: Role;
  pinHash: string;
  status: 'active' | 'suspended';
  createdAt: string;
};

type AccountRuntime = typeof globalThis & { __dolbomDemoAccounts?: Map<string, DemoAccount> };
const runtime = globalThis as AccountRuntime;
const accounts = runtime.__dolbomDemoAccounts ?? new Map<string, DemoAccount>();
runtime.__dolbomDemoAccounts = accounts;

async function hashPin(loginId: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${loginId}:${pin}:${process.env.DEMO_AUTH_SECRET ?? 'local-demo'}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createDemoAccount(input: { loginId: string; pin: string; displayName: string; role: Role }): Promise<DemoAccount> {
  if (accounts.has(input.loginId)) throw new Error('이미 사용 중인 아이디예요.');
  const account: DemoAccount = {
    id: crypto.randomUUID(),
    loginId: input.loginId,
    displayName: input.displayName,
    role: input.role,
    pinHash: await hashPin(input.loginId, input.pin),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  accounts.set(input.loginId, account);
  return account;
}

export async function authenticateDemoAccount(loginId: string, pin: string): Promise<DemoAccount | null> {
  const account = accounts.get(loginId);
  if (!account || account.status !== 'active') return null;
  return account.pinHash === await hashPin(loginId, pin) ? account : null;
}

export function getDemoAccountById(id: string): DemoAccount | undefined {
  return Array.from(accounts.values()).find((account) => account.id === id);
}

export function listDemoAccounts(): DemoAccount[] {
  return Array.from(accounts.values());
}
