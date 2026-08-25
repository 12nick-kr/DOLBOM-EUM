import type { Role } from '@/lib/domain/types';
import { roleSchema } from '@/lib/domain/types';
import { demoFamilyId, demoSeniorId, demoWorkerId } from './store';

/**
 * 데모 인증 — 실제 Supabase Auth/JWT가 붙기 전까지 쓰는 자리표시자.
 * 쿠키(`demo-role`, 서버에서만 읽는 httpOnly)를 우선하고, 없으면 헤더(`x-demo-role`, 테스트/직접 호출용)로 폴백한다.
 */
export function demoActor(request: { headers: Headers; cookies?: { get(name: string): { value: string } | undefined } }): { role: Role; id: string } {
  const cookieRole = request.cookies?.get('demo-role')?.value;
  const headerRole = request.headers.get('x-demo-role');
  const role = roleSchema.catch('senior').parse(cookieRole ?? headerRole ?? 'senior');
  return { role, id: role === 'senior' ? demoSeniorId : role === 'family' ? demoFamilyId : demoWorkerId };
}
