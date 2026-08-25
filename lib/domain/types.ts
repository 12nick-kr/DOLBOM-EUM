import { z } from 'zod';

export const roleSchema = z.enum(['senior', 'family', 'worker']);
export type Role = z.infer<typeof roleSchema>;
export const urgencySchema = z.enum(['normal', 'welfare', 'caution', 'emergency']);
export type Urgency = z.infer<typeof urgencySchema>;
export const speechStatusSchema = z.enum(['idle', 'loading', 'playing', 'paused', 'completed', 'browser_fallback', 'unavailable', 'error']);
export type SpeechStatus = z.infer<typeof speechStatusSchema>;

export const intentResultSchema = z.object({
  intent: z.enum(['conversation', 'service_request', 'emergency', 'facility_search']),
  urgency: urgencySchema,
  summary: z.string().min(1),
  missing_fields: z.array(z.string()),
  proposed_tool: z.string().nullable(),
  requires_confirmation: z.boolean(),
});
export type IntentResult = z.infer<typeof intentResultSchema>;

export type AssistantTurn = IntentResult & { id: string; seniorId: string; assistant_text: string; speech_status: SpeechStatus; createdAt: string };

/**
 * 요청 카드 상태 전이 (PRD §7.4):
 *   draft ──(노인 확인)──> new ──(담당 지정/열람)──> in_progress ──> done
 *     │                     │                            │
 *     └──(노인 취소)        └──(노인 취소)               └──> rejected
 *
 * `draft`는 클라이언트 전용 상태이며 서버에 절대 저장하지 않는다.
 */
export const requestStatusSchema = z.enum(['draft', 'new', 'in_progress', 'done', 'rejected']);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

/** 서버에 저장 가능한 상태만 — `draft`는 클라이언트 전용이라 여기서 제외한다. */
export const persistedRequestStatusSchema = z.enum(['new', 'in_progress', 'done', 'rejected']);
export type PersistedRequestStatus = z.infer<typeof persistedRequestStatusSchema>;

export const requestTypeSchema = z.enum(['hospital_escort', 'welfare_info', 'daily_help']);
export type RequestType = z.infer<typeof requestTypeSchema>;

export const requestInputTypeSchema = z.enum(['voice', 'text']);
export type RequestInputType = z.infer<typeof requestInputTypeSchema>;

/** 노인이 확인한 입력을 서버에 남기는 append-only JSON 계약. 부분 전사·초안은 이 계약에 들어오지 않는다. */
export const seniorInputCategorySchema = z.enum(['daily', 'service_request', 'health_caution', 'emergency']);
export type SeniorInputCategory = z.infer<typeof seniorInputCategorySchema>;
export const inputVisibilitySchema = z.object({
  family: z.enum(['summary_only', 'none']),
  worker: z.enum(['full', 'summary_only']),
});
export type InputVisibility = z.infer<typeof inputVisibilitySchema>;
export const seniorInputEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  seniorId: z.string().min(1),
  source: requestInputTypeSchema,
  transcript: z.string().min(1),
  category: seniorInputCategorySchema,
  urgency: urgencySchema,
  summary: z.string().min(1),
  serviceRequestId: z.string().nullable(),
  emergencyEventId: z.string().nullable().optional(),
  visibility: inputVisibilitySchema,
  confirmedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type SeniorInputEvent = z.infer<typeof seniorInputEventSchema>;

/** 구조화된 요청 상세 필드 — 희망 일시, 목적지, 이동 지원 필요 여부 등 (PRD §7.1, §7.4). */
export const requestDetailsSchema = z.object({
  destination: z.string().optional(),
  desiredAt: z.string().optional(),
  needsTransportHelp: z.boolean().optional(),
}).catchall(z.unknown());
export type RequestDetails = z.infer<typeof requestDetailsSchema>;

/**
 * 요청 카드 — 제품의 중심 객체이며 `service_requests` 한 행에 1:1로 대응한다 (PRD §7.4).
 * 세 역할 화면은 이 카드 하나를 권한에 맞게 다르게 렌더링할 뿐, 역할별로 다른 데이터 구조를 만들지 않는다.
 */
export const serviceRequestSchema = z.object({
  id: z.string(),
  seniorId: z.string(),
  sourceEventId: z.string().nullable().optional(),
  type: requestTypeSchema,
  summary: z.string().min(1),
  transcript: z.string(),
  inputType: requestInputTypeSchema,
  details: requestDetailsSchema,
  missingFields: z.array(z.string()),
  status: persistedRequestStatusSchema,
  assigneeId: z.string().nullable(),
  acknowledgedAt: z.string().nullable(),
  dueAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;

/** 노인 확인 전 클라이언트에서만 존재하는 요청 카드 초안. 서버에 저장하지 않는다. */
export type ServiceRequestDraft = {
  seniorId: string;
  type: RequestType;
  summary: string;
  transcript: string;
  inputType: RequestInputType;
  details: RequestDetails;
  missingFields: string[];
};

export type EmergencyEvent = { id: string; seniorId: string; utterance: string; location: string; level: 'emergency'; status: 'detected' | 'family_acknowledged' | 'worker_followup' | 'closed'; createdAt: string; actions: EmergencyAction[] };
export type EmergencyAction = { actor: Role; action: string; at: string; result: string };
export type ConsentGrant = { id: string; seniorId: string; granteeId: string; scope: 'health' | 'location' | 'service' | 'emergency' | 'conversation_summary'; expiresAt: string; revokedAt: string | null };
export type AuthorityDocument = { id: string; seniorId: string; holderId: string; type: 'proxy' | 'family_proof'; objectPath: string; mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; sizeBytes: number; reviewStatus: 'uploaded' | 'verified'; deletedAt: string | null };
