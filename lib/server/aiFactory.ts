import type { AiPort } from './ai';
import { fixtureAi } from './ai';
import { createOpenAiPort } from './openaiAdapter';

export type AiPortSelection = { port: AiPort; provider: 'fixture' | 'openai' };

/**
 * OpenAI 어댑터 선택 단일 결정 지점 (PRD §11.5: "자격증명이 있으면 운영 코드 경로에서 실제로
 * 호출한다. 조용히 mock으로 대체하지 않는다"). 두 자격증명이 모두 있을 때만 real adapter를 쓴다 —
 * 하나만 있는 경우도 fixture로 폴백해 "부분 자격증명으로 반쯤 동작"하는 상태를 만들지 않는다.
 */
export function selectAiPort(env: Record<string, string | undefined> = process.env): AiPortSelection {
  const hasCredentials = Boolean(env.OPENAI_API_KEY) && Boolean(env.OPENAI_PROJECT_ID);
  if (!hasCredentials) return { port: fixtureAi, provider: 'fixture' };
  return { port: createOpenAiPort(env), provider: 'openai' };
}
