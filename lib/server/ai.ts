import { modelConfig } from '@/lib/config';
import type { AssistantTurn } from '@/lib/domain/types';
import { state } from './store';

/**
 * 전사·음성 재생 포트. 의도/요청 카드 생성은 `lib/server/chatUseCase.ts`의
 * `respondToUtterance`가 담당한다(텍스트/음성 입력이 같은 use case를 공유하도록 분리).
 */
export interface AiPort { transcribe(): { transcript: string; isDemo: boolean }; speech(turnId: string, actorSeniorId: string): AssistantTurn | null; }
export const fakeAi: AiPort = {
  transcribe: () => ({ transcript: '다음 주 병원 갈 때 같이 갈 사람이 필요해요.', isDemo: true }),
  speech(turnId, actorSeniorId) { const turn = state.turns.find((item) => item.id === turnId && item.seniorId === actorSeniorId); return turn ?? null; },
};
export const aiRuntime = { provider: 'fixture', models: modelConfig, store: false } as const;
