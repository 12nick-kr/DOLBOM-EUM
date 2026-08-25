import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emergencyEvents } from '@/lib/server/store';
import { demoActor } from '@/lib/server/auth';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = demoActor(request);
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
