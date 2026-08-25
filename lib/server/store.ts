import type { AssistantTurn, ConsentGrant, EmergencyEvent } from '@/lib/domain/types';
import { selectServiceRequestRepository } from './serviceRequestRepositoryFactory';
import { selectSeniorInputRepository } from './seniorInputRepositoryFactory';
import { InMemorySeniorInputRepository } from './seniorInputRepository';
import { selectEmergencyRepository } from './emergencyRepositoryFactory';
import { realtime } from './realtime';
import { demoFamilyId, demoSeniorId, demoWorkerId } from './storeIds';
import { selectCareRelationshipRepository } from './careRelationshipRepositoryFactory';

export { demoFamilyId, demoSeniorId, demoWorkerId } from './storeIds';

const now = () => new Date().toISOString();
// 실제 Supabase 스키마(0001_demo_schema.sql)에서 senior_id/assignee_id는 profiles(id uuid)를
// 참조하는 uuid 컬럼이다. 문자열 슬러그(예: 'senior-demo-001')는 uuid 캐스팅/FK 제약을
// 통과하지 못해 실제 프로젝트 대상 INSERT가 실패하므로, 데모 계정도 고정 UUID를 쓴다.
// 이 세 UUID에 대응하는 profiles 행은 supabase/migrations/0002_seed_demo_profiles.sql로 시딩한다.
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
type RuntimeRepositories = typeof globalThis & {
  __dolbomServiceRequests?: ReturnType<typeof selectServiceRequestRepository>;
  __dolbomSeniorInputs?: ReturnType<typeof selectSeniorInputRepository>;
  __dolbomEmergencies?: ReturnType<typeof selectEmergencyRepository>;
  __dolbomCareRelationships?: ReturnType<typeof selectCareRelationshipRepository>;
};
const runtimeRepositories = globalThis as RuntimeRepositories;

// Next.js 개발 서버는 route handler를 서로 다른 번들로 만들 수 있다. 로컬 fake 저장소를 모듈
// 변수에만 두면 POST/GET/PATCH가 각자 다른 배열을 보므로, 한 런타임 안에서는 globalThis에
// 포트를 고정한다. 운영의 다중 인스턴스 정본은 여전히 Supabase이며 이 공유에 의존하지 않는다.
const repositorySelection = runtimeRepositories.__dolbomServiceRequests ?? selectServiceRequestRepository();
runtimeRepositories.__dolbomServiceRequests = repositorySelection;
export const serviceRequests = repositorySelection.repository;
export const serviceRequestsProvider = repositorySelection.provider;
// 저장소 변경을 실시간 포트로 그대로 전달한다 — 카드 등록/상태 변경이 곧 realtime 이벤트가 된다.
serviceRequests.onChange((event) => realtime.publish(event));

const seniorInputSelection = runtimeRepositories.__dolbomSeniorInputs ?? selectSeniorInputRepository();
runtimeRepositories.__dolbomSeniorInputs = seniorInputSelection;
export const seniorInputs = seniorInputSelection.repository;
export const seniorInputsProvider = seniorInputSelection.provider;
if (seniorInputs instanceof InMemorySeniorInputRepository) {
  (globalThis as { __resetSeniorInputsForTest?: () => void }).__resetSeniorInputsForTest = () => seniorInputs.reset();
}

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

const emergencySeed: EmergencyEvent[] = [{ id: 'emergency-demo-001', seniorId: demoSeniorId, utterance: '가슴이 조이고 숨쉬기가 힘들어요.', location: '대전광역시 중구 (데모 위치)', level: 'emergency', status: 'detected', createdAt: now(), actions: [{ actor: 'senior', action: '긴급 화면 열기', result: '119 전화 전 확인 대기', at: now() }] }];
const emergencySelection = runtimeRepositories.__dolbomEmergencies ?? selectEmergencyRepository(process.env, emergencySeed);
runtimeRepositories.__dolbomEmergencies = emergencySelection;
export const emergencyEvents = emergencySelection.repository;
export const emergencyEventsProvider = emergencySelection.provider;

const careRelationshipSelection = runtimeRepositories.__dolbomCareRelationships ?? selectCareRelationshipRepository();
runtimeRepositories.__dolbomCareRelationships = careRelationshipSelection;
export const careRelationships = careRelationshipSelection.repository;
export const careRelationshipsProvider = careRelationshipSelection.provider;

export const state: { turns: AssistantTurn[]; consents: ConsentGrant[] } = {
  turns: [],
  consents: ['health', 'location', 'service', 'emergency'].map((scope, index) => ({ id: `consent-${index}`, seniorId: demoSeniorId, granteeId: demoFamilyId, scope: scope as ConsentGrant['scope'], expiresAt: '2027-08-25T00:00:00+09:00', revokedAt: null })),
};
export function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
