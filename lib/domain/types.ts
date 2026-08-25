import { z } from 'zod';

export const roleSchema = z.enum(['senior', 'family', 'worker']);
export type Role = z.infer<typeof roleSchema>;
export const urgencySchema = z.enum(['normal', 'welfare', 'caution', 'emergency']);
export type Urgency = z.infer<typeof urgencySchema>;
export const requestStatusSchema = z.enum(['new', 'needs_info', 'family_check', 'connecting', 'completed', 'rejected']);
export type RequestStatus = z.infer<typeof requestStatusSchema>;
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
export type ServiceRequest = { id: string; seniorId: string; type: 'hospital_companion' | 'welfare_info'; details: string; destination?: string; dueAt?: string; status: RequestStatus; assignee: string | null; createdAt: string; updatedAt: string };
export type EmergencyEvent = { id: string; seniorId: string; utterance: string; location: string; level: 'emergency'; status: 'detected' | 'family_acknowledged' | 'worker_followup' | 'closed'; createdAt: string; actions: EmergencyAction[] };
export type EmergencyAction = { actor: Role; action: string; at: string; result: string };
export type ConsentGrant = { id: string; seniorId: string; granteeId: string; scope: 'health' | 'location' | 'service' | 'emergency' | 'conversation_summary'; expiresAt: string; revokedAt: string | null };
export type AuthorityDocument = { id: string; seniorId: string; holderId: string; type: 'proxy' | 'family_proof'; objectPath: string; mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; sizeBytes: number; reviewStatus: 'uploaded' | 'verified'; deletedAt: string | null };
