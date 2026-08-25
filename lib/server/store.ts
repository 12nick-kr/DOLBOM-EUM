import type { AssistantTurn, ConsentGrant, EmergencyEvent, ServiceRequest } from '@/lib/domain/types';

const now = () => new Date().toISOString();
export const demoSeniorId = 'senior-demo-001';
export const demoFamilyId = 'family-demo-001';
export const demoWorkerId = 'worker-demo-001';
export const state: { turns: AssistantTurn[]; requests: ServiceRequest[]; emergencies: EmergencyEvent[]; consents: ConsentGrant[] } = {
  turns: [],
  requests: [{ id: 'request-demo-001', seniorId: demoSeniorId, type: 'hospital_companion', details: '다음 주 화요일 충남대병원 동행이 필요해요.', destination: '충남대학교병원', dueAt: '2026-09-01T10:00:00+09:00', status: 'new', assignee: null, createdAt: now(), updatedAt: now() }],
  emergencies: [{ id: 'emergency-demo-001', seniorId: demoSeniorId, utterance: '가슴이 조이고 숨쉬기가 힘들어요.', location: '대전광역시 중구 (데모 위치)', level: 'emergency', status: 'detected', createdAt: now(), actions: [{ actor: 'senior', action: '긴급 화면 열기', result: '119 전화 전 확인 대기', at: now() }] }],
  consents: ['health', 'location', 'service', 'emergency'].map((scope, index) => ({ id: `consent-${index}`, seniorId: demoSeniorId, granteeId: demoFamilyId, scope: scope as ConsentGrant['scope'], expiresAt: '2027-08-25T00:00:00+09:00', revokedAt: null })),
};
export function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
