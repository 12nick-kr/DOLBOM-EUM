import { modelConfig } from '@/lib/config';
import { intentResultSchema, type IntentResult } from '@/lib/domain/types';
import { classifyUrgency } from '@/lib/domain/urgency';
import { draftServiceRequest } from '@/lib/domain/requestDraft';
import type { RequestInputType, ServiceRequestDraft } from '@/lib/domain/types';

export type TranscribeResult = { transcript: string; isDemo: boolean };
export type SpeechResult = { audio: ArrayBuffer | null; isDemo: boolean; contentType: string };
export type ClassifyInput = { text: string; priorDraft?: ServiceRequestDraft; inputType?: RequestInputType; seniorId?: string };
export type ClassifyResult = IntentResult & { draft?: ServiceRequestDraft };

/**
 * 전사·의도 분류·음성 합성 포트 (PRD §11.5 표). 두 구현을 갖는다:
 * - `fixtureAi`: 단위/컴포넌트 테스트 전용, 네트워크를 전혀 쓰지 않는다.
 * - `openaiAi`(lib/server/openaiAdapter.ts): 자격증명이 있을 때 운영 경로가 쓰는 실제 어댑터.
 * `lib/server/aiFactory.ts`가 둘 중 하나를 고르는 단일 결정 지점이다.
 */
export interface AiPort {
  transcribe(audio: ArrayBuffer, mimeType: string): Promise<TranscribeResult>;
  classifyAndDraft(input: ClassifyInput): Promise<ClassifyResult>;
  speech(text: string): Promise<SpeechResult>;
}

/**
 * 고정 긴급 키워드 규칙은 실제 모델 호출과 무관하게 항상 먼저 평가한다 (PRD §11.1/TDD §3.6:
 * "고위험 판단은 모델만 믿지 않는다"). fixture와 real 어댑터 둘 다 이 순서를 지키도록,
 * 공통 헬퍼로 분리해 두 구현이 동일하게 재사용한다.
 */
export function classifyWithHardEmergencyGate(text: string): IntentResult {
  return classifyUrgency(text);
}

function buildClassifyResult(text: string, priorDraft: ServiceRequestDraft | undefined, inputType: RequestInputType, seniorId: string, base: IntentResult): ClassifyResult {
  const result = priorDraft && base.urgency !== 'emergency' ? { ...base, intent: 'service_request' as const } : base;
  const parsed = intentResultSchema.parse(result);
  if (parsed.intent !== 'service_request') return parsed;
  return { ...parsed, draft: draftServiceRequest({ text, seniorId, inputType, priorDraft }) };
}

export const fixtureAi: AiPort = {
  async transcribe() {
    return { transcript: '다음 주 병원 갈 때 같이 갈 사람이 필요해요.', isDemo: true };
  },
  async classifyAndDraft({ text, priorDraft, inputType = 'text', seniorId = 'senior-demo-001' }) {
    const base = classifyWithHardEmergencyGate(text);
    return buildClassifyResult(text, priorDraft, inputType, seniorId, base);
  },
  async speech() {
    return { audio: null, isDemo: true, contentType: 'audio/mpeg' };
  },
};

export const aiRuntime = { provider: 'fixture', models: modelConfig, store: false } as const;
