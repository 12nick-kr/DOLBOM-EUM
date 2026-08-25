import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fakeAi } from '@/lib/server/ai';
import { demoSeniorId } from '@/lib/server/store';

const bodySchema = z.object({ text: z.string().min(1).max(1000), seniorId: z.string().default(demoSeniorId) });
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '짧은 요청 내용을 입력해 주세요.' }, { status: 400 });
  return NextResponse.json({ ...fakeAi.respond(parsed.data.text, parsed.data.seniorId), is_demo: true });
}
