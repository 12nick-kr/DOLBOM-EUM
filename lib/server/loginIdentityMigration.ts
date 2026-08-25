import { loginIdSchema, loginIdToInternalEmail } from '@/lib/auth/credentials';
import type { Role } from '@/lib/domain/types';

export type LoginIdentityProfile = { id: string; loginId: string; role: Role };

/** 기존 Auth UUID/비밀번호는 유지하고 로그인 provider 식별자만 내부 이메일로 보완한다. */
export function buildLoginIdentityUpdate(profile: LoginIdentityProfile, currentAppMetadata: Record<string, unknown> = {}) {
  const loginId = loginIdSchema.parse(profile.loginId);
  return {
    email: loginIdToInternalEmail(loginId),
    email_confirm: true as const,
    app_metadata: { ...currentAppMetadata, role: profile.role, demo_account: true, auth_method: 'login_id' },
  };
}

export function maskLoginId(loginId: string): string {
  return `${loginId.slice(0, 3)}-****-${loginId.slice(-4)}`;
}
