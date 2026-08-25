import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { persistedRequestStatusSchema } from '@/lib/domain/types';
import { demoActor } from '@/lib/server/auth';
import { serviceRequests } from '@/lib/server/store';

const patchSchema = z.object({
  status: persistedRequestStatusSchema,
  memo: z.string().max(500).optional(),
});

/**
 * 상태 전이는 담당 복지사만 수행한다(PRD §7.4 "new → in_progress → done은 담당 복지사만 수행한다").
 * assigneeId는 클라이언트가 보낸 값을 신뢰하지 않고 인증된 행위자(demoActor)에서만 가져온다 —
 * 그렇지 않으면 아무 요청이나 다른 사람의 워커 ID를 자칭해 담당자로 등록할 수 있다.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = demoActor(request);
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 상태를 변경할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '요청 내용을 확인해 주세요.' }, { status: 400 });
  try {
    const updated = await serviceRequests.transition(id, parsed.data.status, { assigneeId: actor.id });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '허용되지 않은 상태 변경이에요.' }, { status: 400 });
  }
}
