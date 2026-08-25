import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships, seniorInputs, serviceRequests } from '@/lib/server/store';

const patchSchema = z.object({
  status: z.literal('in_progress'),
  memo: z.string().max(500).optional(),
});

/**
 * 상태 전이는 담당 복지사만 수행한다(PRD §7.4 "new → in_progress → done은 담당 복지사만 수행한다").
 * assigneeId는 클라이언트가 보낸 값을 신뢰하지 않고 인증된 세션 행위자에서만 가져온다 —
 * 그렇지 않으면 아무 요청이나 다른 사람의 워커 ID를 자칭해 담당자로 등록할 수 있다.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 상태를 변경할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(existing.seniorId)) return NextResponse.json({ error: '담당 관계가 없는 요청은 변경할 수 없어요.' }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '요청 내용을 확인해 주세요.' }, { status: 400 });
  try {
    const updated = await serviceRequests.transition(id, parsed.data.status, { assigneeId: actor.id });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '허용되지 않은 상태 변경이에요.' }, { status: 400 });
  }
}

/** 담당 관계가 확인된 사회복지사만 카드와 연결된 원본 JSON을 함께 삭제한다. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 요청을 삭제할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(existing.seniorId)) {
    return NextResponse.json({ error: '담당 관계가 없는 요청은 삭제할 수 없어요.' }, { status: 403 });
  }
  try {
    const deleted = await serviceRequests.delete(id, actor.id);
    if (deleted.sourceEventId) await seniorInputs.delete(deleted.sourceEventId);
    return NextResponse.json({ deleted: true, id });
  } catch {
    return NextResponse.json({ error: '요청을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
