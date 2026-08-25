import type { AssistantTurn, RequestInputType, ServiceRequestDraft } from '@/lib/domain/types';
import { draftServiceRequest } from '@/lib/domain/requestDraft';
import type { AiPort } from './ai';
import { fixtureAi } from './ai';
import { id, state } from './store';

export type ChatUseCaseInput = {
  text: string;
  seniorId: string;
  inputType: RequestInputType;
  purpose?: 'conversation' | 'service_request';
  priorDraft?: ServiceRequestDraft;
};

export type ChatUseCaseResult = AssistantTurn & { draft?: ServiceRequestDraft };

/**
 * 노인의 음성/텍스트 요청을 처리하는 단일 use case. `input_type`만 다를 뿐 음성과 텍스트는
 * 이 함수를 그대로 공유한다 (PRD FR-04/FR-07, TDD §3.8). 복지 의도로 분류되면 자유 대화 로그가
 * 아니라 요청 카드 초안(`draft`)을 만들어 반환하고, 이 초안은 노인이 명시적으로 확인하기 전까지
 * 어떤 저장소에도 쓰지 않는다.
 *
 * 의도 분류/카드 초안 추출은 `AiPort.classifyAndDraft`에 위임한다 (기본값은 fixture 어댑터;
 * 라우트는 `selectAiPort()`가 고른 실제 포트를 명시적으로 주입한다 — PRD §11.5). 고정 긴급
 * 키워드 규칙은 두 어댑터 모두 모델 호출보다 먼저 평가한다(TDD §3.6).
 */
export async function respondToUtterance(input: ChatUseCaseInput, ai: AiPort = fixtureAi): Promise<ChatUseCaseResult> {
  const classified = await ai.classifyAndDraft({ text: input.text, priorDraft: input.priorDraft, inputType: input.inputType, seniorId: input.seniorId });
  const forceRequestDraft = input.purpose === 'service_request' && classified.urgency !== 'emergency';
  const result = forceRequestDraft && (classified.intent !== 'service_request' || !classified.draft)
    ? {
        ...classified,
        intent: 'service_request' as const,
        urgency: classified.urgency === 'normal' ? 'welfare' as const : classified.urgency,
        proposed_tool: 'draft_service_request',
        requires_confirmation: true,
        draft: draftServiceRequest({
          text: input.text,
          seniorId: input.seniorId,
          inputType: input.inputType,
          priorDraft: input.priorDraft,
        }),
      }
    : classified;

  const assistant_text = result.urgency === 'emergency'
    ? '긴급 도움 화면을 열었어요.'
    : result.intent === 'service_request'
      ? result.draft?.missingFields.includes('희망 날짜')
        ? '언제가 편하세요?'
        : '이 내용으로 보내드릴까요?'
      : '말씀 고마워요.';

  const turn: ChatUseCaseResult = {
    ...result,
    id: id('turn'),
    seniorId: input.seniorId,
    assistant_text,
    speech_status: 'idle',
    createdAt: new Date().toISOString(),
  };

  state.turns.push(turn);
  return turn;
}
