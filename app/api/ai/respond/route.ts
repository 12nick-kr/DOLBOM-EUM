import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema } from '@/lib/domain/types';
import { respondToUtterance } from '@/lib/server/chatUseCase';
import { selectAiPort } from '@/lib/server/aiFactory';
import { createAssistantTurnToken } from '@/lib/server/assistantTurnToken';
import { authenticatedActor } from '@/lib/server/auth';
import { classifyUrgency } from '@/lib/domain/urgency';

const priorDraftSchema = z.object({
  seniorId: z.string(),
  type: z.enum(['hospital_escort', 'welfare_info', 'daily_help']),
  summary: z.string(),
  transcript: z.string(),
  inputType: requestInputTypeSchema,
  details: requestDetailsSchema,
  missingFields: z.array(z.string()),
});

const bodySchema = z.object({
  text: z.string().min(1).max(1000),
  seniorId: z.string().optional(),
  inputType: requestInputTypeSchema.default('text'),
  purpose: z.enum(['conversation', 'service_request']).default('conversation'),
  priorDraft: priorDraftSchema.optional(),
});

export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 계정만 AI 요청을 만들 수 있어요.' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '짧은 요청 내용을 입력해 주세요.' }, { status: 400 });
  const { port: ai, provider } = selectAiPort();
  try {
    const input = {
      ...parsed.data,
      seniorId: actor.id,
      priorDraft: parsed.data.priorDraft ? { ...parsed.data.priorDraft, seniorId: actor.id } : undefined,
    };
    const generatedTurn = await respondToUtterance(input, ai);
    const hardGate = classifyUrgency(parsed.data.text);
    const turn = hardGate.urgency === 'emergency'
      ? {
          ...generatedTurn,
          ...hardGate,
          assistant_text: '긴급 도움 화면을 열었어요.',
          draft: undefined,
        }
      : generatedTurn;
    const speech_token = createAssistantTurnToken({ id: turn.id, seniorId: turn.seniorId, text: turn.assistant_text });
    return NextResponse.json({ ...turn, speech_token, is_demo: provider === 'fixture' });
  } catch {
    // PRD §11.5: 자격증명이 있는데 실제 호출이 실패하면 조용히 mock으로 대체하지 않고
    // 명확한 오류 상태를 반환한다. 긴급 버튼/화면 자체는 이 응답과 무관하게 계속 동작한다.
    return NextResponse.json({ error: '지금은 연결할 수 없어요. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }
}
