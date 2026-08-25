import type { AssistantTurn, ConsentGrant, EmergencyEvent } from '@/lib/domain/types';
import { InMemoryServiceRequestRepository } from './serviceRequestRepository';
import { realtime } from './realtime';

const now = () => new Date().toISOString();
export const demoSeniorId = 'senior-demo-001';
export const demoFamilyId = 'family-demo-001';
export const demoWorkerId = 'worker-demo-001';

/**
 * 담당 관계 조회 — PRD §11.4: 구독 단위는 담당 관계다. 실제 구현에서는 `care_relationships`
 * 테이블을 조회하지만, 데모는 고정된 1:1 배정(demoWorkerId → demoSeniorId)만 시드한다.
 */
export function seniorIdsAssignedTo(workerId: string): string[] {
  return workerId === demoWorkerId ? [demoSeniorId] : [];
}

export const serviceRequests = new InMemoryServiceRequestRepository();
// 저장소 변경을 실시간 포트로 그대로 전달한다 — 카드 등록/상태 변경이 곧 realtime 이벤트가 된다.
serviceRequests.onChange((event) => realtime.publish(event));

// 데모 시드 카드 — idempotency key로 생성해 재시작 시에도 동일 규칙을 통과한다.
serviceRequests.create({
  seniorId: demoSeniorId,
  type: 'hospital_escort',
  summary: '다음 주 화요일 충남대병원 동행이 필요해요.',
  transcript: '다음 주 화요일 충남대병원 갈 때 같이 갈 사람이 필요해요.',
  inputType: 'voice',
  details: { destination: '충남대학교병원', desiredAt: '2026-09-01T10:00:00+09:00', needsTransportHelp: true },
  missingFields: [],
  idempotencyKey: 'seed-request-demo-001',
  dueAt: '2026-09-01T10:00:00+09:00',
});

export const state: { turns: AssistantTurn[]; emergencies: EmergencyEvent[]; consents: ConsentGrant[] } = {
  turns: [],
  emergencies: [{ id: 'emergency-demo-001', seniorId: demoSeniorId, utterance: '가슴이 조이고 숨쉬기가 힘들어요.', location: '대전광역시 중구 (데모 위치)', level: 'emergency', status: 'detected', createdAt: now(), actions: [{ actor: 'senior', action: '긴급 화면 열기', result: '119 전화 전 확인 대기', at: now() }] }],
  consents: ['health', 'location', 'service', 'emergency'].map((scope, index) => ({ id: `consent-${index}`, seniorId: demoSeniorId, granteeId: demoFamilyId, scope: scope as ConsentGrant['scope'], expiresAt: '2027-08-25T00:00:00+09:00', revokedAt: null })),
};
export function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
