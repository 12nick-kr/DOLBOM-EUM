import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fakeAi } from '@/lib/server/ai';
import { demoSeniorId } from '@/lib/server/store';
export async function POST(request: NextRequest) {
  const data = z.object({ assistant_turn_id: z.string(), senior_id: z.string().default(demoSeniorId) }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: 'assistant_turn_id가 필요해요.' }, { status: 400 });
  const turn = fakeAi.speech(data.data.assistant_turn_id, data.data.senior_id);
  if (!turn) return NextResponse.json({ error: '권한이 없거나 답변을 찾을 수 없어요.' }, { status: 403 });
  return NextResponse.json({ assistant_turn_id: turn.id, speech_status: 'browser_fallback', text: turn.assistant_text }, { headers: { 'Cache-Control': 'private, no-store' } });
}
