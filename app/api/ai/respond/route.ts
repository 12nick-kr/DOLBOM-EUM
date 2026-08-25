import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema } from '@/lib/domain/types';
import { respondToUtterance } from '@/lib/server/chatUseCase';
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
  const turn = respondToUtterance(parsed.data);
  return NextResponse.json({ ...turn, is_demo: true });
}
