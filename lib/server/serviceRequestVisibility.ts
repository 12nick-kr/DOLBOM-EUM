import { redactForRole } from '@/lib/domain/policies';
import type { Role, ServiceRequest } from '@/lib/domain/types';
import { demoSeniorId, demoWorkerId, seniorIdsAssignedTo, serviceRequests } from './store';

/**
 * 역할에 따라 허용된 카드만 반환하고 필요한 필드를 지운다 (PRD §7.4/§11.4). `GET /api/service-requests`와
 * SSE 스트림(`GET /api/service-requests/stream`)이 정확히 같은 범위·redaction 규칙을 쓰도록 여기 한 곳에서만 정의한다.
 */
export async function getVisibleRequests(actor: { role: Role; id: string }): Promise<Array<ServiceRequest & { transcript?: string }>> {
  const all = await serviceRequests.list();
  const scoped = actor.role === 'senior'
    ? await serviceRequests.listForSenior(actor.id)
    : actor.role === 'worker'
      ? all.filter((row) => seniorIdsAssignedTo(actor.id).includes(row.seniorId))
      : all.filter((row) => seniorIdsAssignedTo(demoWorkerId).includes(row.seniorId) || row.seniorId === demoSeniorId);
  // 가족 화면에는 별도 동의(transcriptConsent) 없이는 원문을 노출하지 않는다.
  return scoped.map((row) => redactForRole(row, actor.role, { transcriptConsent: false }));
}

export async function getVisibleRequest(actor: { role: Role; id: string }, id: string): Promise<(ServiceRequest & { transcript?: string }) | undefined> {
  const row = await serviceRequests.get(id);
  if (!row) return undefined;
  const canSee = actor.role === 'senior'
    ? row.seniorId === actor.id
    : actor.role === 'worker'
      ? seniorIdsAssignedTo(actor.id).includes(row.seniorId)
      : row.seniorId === demoSeniorId;
  return canSee ? redactForRole(row, actor.role, { transcriptConsent: false }) : undefined;
}
