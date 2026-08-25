import { modelConfig } from '@/lib/config';
import { intentResultSchema, type IntentResult } from '@/lib/domain/types';
import { draftServiceRequest } from '@/lib/domain/requestDraft';
import { classifyWithHardEmergencyGate, type AiPort, type ClassifyInput, type ClassifyResult, type SpeechResult, type TranscribeResult } from './ai';
import { demoSeniorId } from './store';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

function authHeaders(env: Record<string, string | undefined>): Record<string, string> {
  return {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    'OpenAI-Project': env.OPENAI_PROJECT_ID as string,
  };
}

/**
 * 구조화된 의도 분류를 위한 JSON Schema (Responses API Structured Outputs). `IntentResult`
 * (lib/domain/types.ts)와 정확히 같은 모양이어야 서버가 그대로 zod로 재검증할 수 있다.
 */
const intentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['conversation', 'service_request', 'emergency', 'facility_search'] },
    urgency: { type: 'string', enum: ['normal', 'welfare', 'caution', 'emergency'] },
    summary: { type: 'string' },
    missing_fields: { type: 'array', items: { type: 'string' } },
    proposed_tool: { type: ['string', 'null'] },
    requires_confirmation: { type: 'boolean' },
  },
  required: ['intent', 'urgency', 'summary', 'missing_fields', 'proposed_tool', 'requires_confirmation'],
} as const;

const SYSTEM_PROMPT = [
  '너는 한국어를 쓰는 노인 돌봄 서비스의 AI 도우미다.',
  '노인의 발화를 intent, urgency, summary, missing_fields, proposed_tool, requires_confirmation으로 구조화해라.',
  'intent는 conversation(일상 대화), service_request(병원동행/복지/일상 도움 요청), emergency(위급 상황), facility_search(시설 찾기) 중 하나다.',
  'urgency는 normal, welfare, caution, emergency 중 하나다.',
  'summary는 한 문장 한국어 요약이다.',
  'missing_fields는 요청을 처리하는데 아직 확인되지 않은 항목 이름의 배열이다(예: "희망 날짜").',
  '확신이 낮으면 requires_confirmation을 true로 두고 임의로 실행을 제안하지 않는다.',
  '의료 진단, 처방, 법적 판단을 하지 않는다.',
].join(' ');

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 실제 OpenAI Responses/Transcription/Speech 어댑터 (PRD §11.5 표: "운영 구현"). 세 엔드포인트
 * 모두 동일한 `OPENAI_API_KEY`/`OPENAI_PROJECT_ID`로 인증한다(PRD §11.2). 실패 시 조용히 mock으로
 * 대체하지 않고 예외를 던져 호출자(라우트)가 명확한 오류 상태로 변환하게 한다.
 */
export function createOpenAiPort(env: Record<string, string | undefined> = process.env): AiPort {
  const headers = authHeaders(env);

  return {
    async transcribe(audio: ArrayBuffer, mimeType: string): Promise<TranscribeResult> {
      const form = new FormData();
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') ? 'mp3' : 'wav';
      form.append('file', new Blob([audio], { type: mimeType }), `speech.${ext}`);
      form.append('model', modelConfig.transcribe);

      const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/audio/transcriptions`, { method: 'POST', headers, body: form }, 20_000);
      if (!res.ok) {
        throw new Error(`transcription_failed:${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      // 무음/짧은 오디오는 실제로 text: ""(빈 문자열)를 정상 반환한다 — falsy 체크로 오분류하지 않는다.
      if (typeof data.text !== 'string') throw new Error('transcription_malformed');
      return { transcript: data.text, isDemo: false };
    },

    async classifyAndDraft(input: ClassifyInput): Promise<ClassifyResult> {
      // 고정 긴급 키워드 규칙을 모델 호출보다 먼저 평가한다 (PRD §11.1/TDD §3.6). 규칙이 긴급을
      // 감지하면 모델 응답과 무관하게 이 결과를 그대로 쓴다 — 모델이 긴급을 놓치더라도 안전하다.
      const hardGate = classifyWithHardEmergencyGate(input.text);
      if (hardGate.urgency === 'emergency') {
        return hardGate;
      }

      const body = {
        model: modelConfig.text,
        store: false,
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input.text },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'intent_result',
            schema: intentJsonSchema,
            strict: true,
          },
        },
      };

      const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/responses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 20_000);
      if (!res.ok) {
        throw new Error(`respond_failed:${res.status}`);
      }
      const data = await res.json();
      const rawText = extractOutputText(data);
      if (!rawText) throw new Error('respond_empty');
      const parsedJson = JSON.parse(rawText);
      // 모델이 emergency를 자체 판단해도, 고정 규칙이 이미 non-emergency로 걸러진 이후이므로
      // 여기서 다시 emergency로 격상시키지는 않는다 — 최종 emergency 판정은 규칙 엔진 하나만 한다.
      const safeParsed: IntentResult = intentResultSchema.parse({
        ...parsedJson,
        urgency: parsedJson.urgency === 'emergency' ? 'caution' : parsedJson.urgency,
        intent: parsedJson.intent === 'emergency' ? 'conversation' : parsedJson.intent,
      });

      if (safeParsed.intent !== 'service_request' && !(input.priorDraft && safeParsed.intent !== 'emergency')) {
        return safeParsed;
      }
      const effectiveIntent: IntentResult = input.priorDraft ? { ...safeParsed, intent: 'service_request' } : safeParsed;
      if (effectiveIntent.intent !== 'service_request') return effectiveIntent;
      const draft = draftServiceRequest({
        text: input.text,
        seniorId: input.seniorId ?? demoSeniorId,
        inputType: input.inputType ?? 'text',
        priorDraft: input.priorDraft,
      });
      return { ...effectiveIntent, draft };
    },

    async speech(text: string): Promise<SpeechResult> {
      const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/audio/speech`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelConfig.tts, voice: 'alloy', input: text, response_format: 'mp3' }),
      }, 5_000);
      if (!res.ok) {
        throw new Error(`speech_failed:${res.status}`);
      }
      const audio = await res.arrayBuffer();
      return { audio, isDemo: false, contentType: 'audio/mpeg' };
    },
  };
}

function extractOutputText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.output_text === 'string' && record.output_text.length > 0) return record.output_text;
  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item !== 'object' || item === null) continue;
      const content = (item as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part === 'object' && part !== null && typeof (part as Record<string, unknown>).text === 'string') {
            return (part as Record<string, unknown>).text as string;
          }
        }
      }
    }
  }
  return null;
}
