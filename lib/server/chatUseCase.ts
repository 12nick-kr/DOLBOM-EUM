import { classifyUrgency } from '@/lib/domain/urgency';
import { draftServiceRequest } from '@/lib/domain/requestDraft';
import type { AssistantTurn, RequestInputType, ServiceRequestDraft } from '@/lib/domain/types';
import { id, state } from './store';

export type ChatUseCaseInput = {
  text: string;
  seniorId: string;
  inputType: RequestInputType;
  priorDraft?: ServiceRequestDraft;
};

export type ChatUseCaseResult = AssistantTurn & { draft?: ServiceRequestDraft };

/**
 * 노인의 음성/텍스트 요청을 처리하는 단일 use case. `input_type`만 다를 뿐 음성과 텍스트는
 * 이 함수를 그대로 공유한다 (PRD FR-04/FR-07, TDD §3.8). 복지 의도로 분류되면 자유 대화 로그가
 * 아니라 요청 카드 초안(`draft`)을 만들어 반환하고, 이 초안은 노인이 명시적으로 확인하기 전까지
 * 어떤 저장소에도 쓰지 않는다.
 */
export function respondToUtterance(input: ChatUseCaseInput): ChatUseCaseResult {
  const classified = classifyUrgency(input.text);
  // 이미 진행 중인 요청 초안에 대한 되물음 답변(예: 날짜만 말하는 짧은 답)은 그 자체로는
  // service_request 키워드가 없을 수 있다. 초안이 있으면 계속 같은 흐름으로 취급한다.
  const result = input.priorDraft && classified.urgency !== 'emergency' ? { ...classified, intent: 'service_request' as const } : classified;

  const assistant_text = result.urgency === 'emergency'
    ? '지금 바로 긴급 도움 화면을 열었어요. 119에 전화할지 함께 확인해요.'
    : result.intent === 'service_request'
      ? '요청 내용을 정리했어요. 맞는지 확인해 주세요.'
      : '말씀해 주셔서 고마워요. 필요한 도움을 함께 찾아볼게요.';

  const turn: ChatUseCaseResult = {
    ...result,
    id: id('turn'),
    seniorId: input.seniorId,
    assistant_text,
    speech_status: 'idle',
    createdAt: new Date().toISOString(),
  };

  if (result.intent === 'service_request') {
    turn.draft = draftServiceRequest({ text: input.text, seniorId: input.seniorId, inputType: input.inputType, priorDraft: input.priorDraft });
  }

  state.turns.push(turn);
  return turn;
}
