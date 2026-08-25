import { redactForRole } from '@/lib/domain/policies';
import type { Role, ServiceRequest } from '@/lib/domain/types';
import { careRelationships, serviceRequests } from './store';

export type VisibleRequest = ServiceRequest & { transcript?: string; seniorName?: string };
type Actor = { role: Role; id: string };

/**
 * 역할에 따라 허용된 카드만 반환하고 필요한 필드를 지운다 (PRD §7.4/§11.4). 목록 조회, 단건 조회,
 * SSE 스트림(`GET /api/care-events`)이 정확히 같은 범위·redaction 규칙을 쓰도록 여기 한 곳에서만 정의한다.
 */

/** 노인 본인은 자기 자신, 가족·복지사는 활성 담당 관계에 있는 노인만 볼 수 있다. */
async function visibleSeniorIdsFor(actor: Actor): Promise<string[]> {
  return actor.role === 'senior' ? [actor.id] : careRelationships.seniorIdsForMember(actor.id, actor.role);
}

/**
 * 카드에 담당 노인의 표시 이름을 붙인다. 이름이 없으면 화면이 데모 이름으로 되돌아가는 대신
 * 중립 문구를 쓰도록 undefined를 남긴다. 노인 본인 화면은 "대상"을 표시하지 않으므로 생략한다.
 */
async function withSeniorNames(rows: VisibleRequest[], actor: Actor): Promise<VisibleRequest[]> {
  if (actor.role === 'senior') return rows;
  const names = new Map<string, string | undefined>();
  for (const seniorId of new Set(rows.map((row) => row.seniorId))) {
    names.set(seniorId, (await careRelationships.getProfile(seniorId))?.displayName);
  }
  return rows.map((row) => ({ ...row, seniorName: names.get(row.seniorId) }));
}

export async function getVisibleRequests(actor: Actor): Promise<VisibleRequest[]> {
  const seniorIds = await visibleSeniorIdsFor(actor);
  const scoped = actor.role === 'senior'
    ? await serviceRequests.listForSenior(actor.id)
    : (await serviceRequests.list()).filter((row) => seniorIds.includes(row.seniorId));
  // 가족 화면에는 별도 동의(transcriptConsent) 없이는 원문을 노출하지 않는다.
  return withSeniorNames(scoped.map((row) => redactForRole(row, actor.role, { transcriptConsent: false })), actor);
}

export async function getVisibleRequest(actor: Actor, id: string): Promise<VisibleRequest | undefined> {
  const row = await serviceRequests.get(id);
  if (!row) return undefined;
  if (!(await visibleSeniorIdsFor(actor)).includes(row.seniorId)) return undefined;
  const [visible] = await withSeniorNames([redactForRole(row, actor.role, { transcriptConsent: false })], actor);
  return visible;
}
