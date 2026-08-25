import type { AssistantTurn, ConsentGrant, EmergencyEvent } from '@/lib/domain/types';
import { selectServiceRequestRepository } from './serviceRequestRepositoryFactory';
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

// PRD §11.5 단일 결정 지점: Supabase 세 환경변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY 등)가
// 있으면 Postgres 어댑터를, 없으면 in-memory fake를 쓴다. 어느 쪽이든 같은 ServiceRequestRepository
// 인터페이스라 이 파일을 쓰는 나머지 코드(라우트)는 분기를 몰라도 된다.
const repositorySelection = selectServiceRequestRepository();
export const serviceRequests = repositorySelection.repository;
export const serviceRequestsProvider = repositorySelection.provider;
// 저장소 변경을 실시간 포트로 그대로 전달한다 — 카드 등록/상태 변경이 곧 realtime 이벤트가 된다.
serviceRequests.onChange((event) => realtime.publish(event));

// 데모 시드 카드는 in-memory 모드에서만 넣는다 — 실제 Supabase 프로젝트에 데모 계정 소유가 아닌
// 시드 행을 코드가 스스로 INSERT하지 않는다(PRD §11.5 "코드가 스스로 스키마/데이터를 바꾸지 않는다"
// 원칙의 연장). idempotency key로 생성해 재시작 시에도 동일 규칙을 통과한다.
if (repositorySelection.provider === 'in-memory') {
  void serviceRequests.create({
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
}

export const state: { turns: AssistantTurn[]; emergencies: EmergencyEvent[]; consents: ConsentGrant[] } = {
  turns: [],
  emergencies: [{ id: 'emergency-demo-001', seniorId: demoSeniorId, utterance: '가슴이 조이고 숨쉬기가 힘들어요.', location: '대전광역시 중구 (데모 위치)', level: 'emergency', status: 'detected', createdAt: now(), actions: [{ actor: 'senior', action: '긴급 화면 열기', result: '119 전화 전 확인 대기', at: now() }] }],
  consents: ['health', 'location', 'service', 'emergency'].map((scope, index) => ({ id: `consent-${index}`, seniorId: demoSeniorId, granteeId: demoFamilyId, scope: scope as ConsentGrant['scope'], expiresAt: '2027-08-25T00:00:00+09:00', revokedAt: null })),
};
export function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
