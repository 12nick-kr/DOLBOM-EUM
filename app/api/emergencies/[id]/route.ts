import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { careRelationships, emergencyEvents, seniorInputs } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const { id } = await context.params;
  const parsed = z.object({
    status: z.enum(['family_acknowledged', 'worker_followup', 'closed']),
    action: z.string().min(1).max(200),
    actor: z.enum(['family', 'worker']).optional(),
    closeReason: z.enum(['senior_cancelled', 'resolved', 'false_alarm']).optional(),
  }).safeParse(await request.json());
  const event = await emergencyEvents.get(id); if (!event) return NextResponse.json({ error: '알림을 찾을 수 없어요.' }, { status: 404 });
  if (!parsed.success) return NextResponse.json({ error: '처리 정보를 확인해 주세요.' }, { status: 400 });
  if (actor.role === 'senior') {
    if (event.seniorId !== actor.id || parsed.data.status !== 'closed' || !parsed.data.closeReason) {
      return NextResponse.json({ error: '본인의 긴급 상황 종료만 처리할 수 있어요.' }, { status: 403 });
    }
  } else if (actor.role === 'family') {
    return NextResponse.json({ error: '부양가족 계정은 긴급 현황을 열람만 할 수 있어요.' }, { status: 403 });
  } else if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(event.seniorId)) {
    return NextResponse.json({ error: '담당 관계가 없는 긴급 상황은 변경할 수 없어요.' }, { status: 403 });
  }
  const updated = await emergencyEvents.update(id, {
    status: parsed.data.status,
    actor: actor.role,
    actorId: actor.id,
    action: parsed.data.action,
    closeReason: parsed.data.closeReason,
  });
  return NextResponse.json(updated);
}

/** 담당 사회복지사가 긴급 이벤트와 연결된 노인 입력 JSON을 서버에서 함께 제거한다. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 긴급 알림을 삭제할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const event = await emergencyEvents.get(id);
  if (!event) return NextResponse.json({ error: '이미 삭제됐거나 찾을 수 없는 긴급 알림이에요.' }, { status: 404 });
  if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(event.seniorId)) return NextResponse.json({ error: '담당 관계가 없는 긴급 알림은 삭제할 수 없어요.' }, { status: 403 });
  try {
    const source = (await seniorInputs.listForSenior(event.seniorId)).find((input) => input.emergencyEventId === id);
    await emergencyEvents.delete(id, actor.id);
    if (source) await seniorInputs.delete(source.id);
    return NextResponse.json({ deleted: true, id, sourceEventDeleted: Boolean(source) });
  } catch {
    return NextResponse.json({ error: '긴급 알림을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
