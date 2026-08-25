import type { Role } from '@/lib/domain/types';
import { roleSchema } from '@/lib/domain/types';
import { demoFamilyId, demoSeniorId, demoWorkerId } from './store';

export function demoActor(headers: Headers): { role: Role; id: string } {
  const role = roleSchema.catch('senior').parse(headers.get('x-demo-role') ?? 'senior');
  return { role, id: role === 'senior' ? demoSeniorId : role === 'family' ? demoFamilyId : demoWorkerId };
}
