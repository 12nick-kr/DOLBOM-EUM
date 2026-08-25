import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema } from '@/lib/domain/types';
import { respondToUtterance } from '@/lib/server/chatUseCase';
import { selectAiPort } from '@/lib/server/aiFactory';
import { demoSeniorId } from '@/lib/server/store';

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
  seniorId: z.string().default(demoSeniorId),
  inputType: requestInputTypeSchema.default('text'),
  priorDraft: priorDraftSchema.optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '짧은 요청 내용을 입력해 주세요.' }, { status: 400 });
  const { port: ai, provider } = selectAiPort();
  try {
    const turn = await respondToUtterance(parsed.data, ai);
    return NextResponse.json({ ...turn, is_demo: provider === 'fixture' });
  } catch {
    // PRD §11.5: 자격증명이 있는데 실제 호출이 실패하면 조용히 mock으로 대체하지 않고
    // 명확한 오류 상태를 반환한다. 긴급 버튼/화면 자체는 이 응답과 무관하게 계속 동작한다.
    return NextResponse.json({ error: '지금은 연결할 수 없어요. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }
}
