import type { Role } from '@/lib/domain/types';

export type DemoAccount = {
  id: string;
  phone: string;
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

async function hashPin(phone: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${phone}:${pin}:${process.env.DEMO_AUTH_SECRET ?? 'local-demo'}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createDemoAccount(input: { phone: string; pin: string; displayName: string; role: Role }): Promise<DemoAccount> {
  if (accounts.has(input.phone)) throw new Error('이미 사용 중인 가상 전화번호예요.');
  const account: DemoAccount = {
    id: crypto.randomUUID(),
    phone: input.phone,
    displayName: input.displayName,
    role: input.role,
    pinHash: await hashPin(input.phone, input.pin),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  accounts.set(input.phone, account);
  return account;
}

export async function authenticateDemoAccount(phone: string, pin: string): Promise<DemoAccount | null> {
  const account = accounts.get(phone);
  if (!account || account.status !== 'active') return null;
  return account.pinHash === await hashPin(phone, pin) ? account : null;
}

export function getDemoAccountById(id: string): DemoAccount | undefined {
  return Array.from(accounts.values()).find((account) => account.id === id);
}

export function listDemoAccounts(): DemoAccount[] {
  return Array.from(accounts.values());
}
