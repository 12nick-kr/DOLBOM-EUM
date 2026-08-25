import { modelConfig } from '@/lib/config';
import { classifyUrgency } from '@/lib/domain/urgency';
import type { AssistantTurn } from '@/lib/domain/types';
import { id, state } from './store';

export interface AiPort { respond(text: string, seniorId: string): AssistantTurn; transcribe(): { transcript: string; isDemo: boolean }; speech(turnId: string, actorSeniorId: string): AssistantTurn | null; }
export const fakeAi: AiPort = {
  respond(text, seniorId) {
    const result = classifyUrgency(text);
    const assistant_text = result.urgency === 'emergency' ? '지금 바로 긴급 도움 화면을 열었어요. 119에 전화할지 함께 확인해요.' : result.intent === 'service_request' ? '병원 동행 요청으로 정리했어요. 내용을 확인하고 담당자에게 보낼까요?' : '말씀해 주셔서 고마워요. 필요한 도움을 함께 찾아볼게요.';
    const turn: AssistantTurn = { ...result, id: id('turn'), seniorId, assistant_text, speech_status: 'idle', createdAt: new Date().toISOString() };
    state.turns.push(turn); return turn;
  },
  transcribe: () => ({ transcript: '다음 주 병원 갈 때 같이 갈 사람이 필요해요.', isDemo: true }),
  speech(turnId, actorSeniorId) { const turn = state.turns.find((item) => item.id === turnId && item.seniorId === actorSeniorId); return turn ?? null; },
};
export const aiRuntime = { provider: 'fixture', models: modelConfig, store: false } as const;
