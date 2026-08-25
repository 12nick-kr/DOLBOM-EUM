import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyUrgency } from '@/lib/domain/urgency';
import { authenticatedActor } from '@/lib/server/auth';
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 계정만 요청을 분석할 수 있어요.' }, { status: 403 });
  const data = z.object({ text: z.string().min(1) }).safeParse(await request.json());
  return data.success ? NextResponse.json(classifyUrgency(data.data.text)) : NextResponse.json({ error: 'text가 필요해요.' }, { status: 400 });
}
