import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emergencyEvents } from '@/lib/server/store';
import { demoActor } from '@/lib/server/auth';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = demoActor(request);
  if (actor.role === 'senior') return NextResponse.json({ error: '가족 또는 담당 사회복지사만 처리할 수 있어요.' }, { status: 403 });
  const { id } = await context.params; const parsed = z.object({ status: z.enum(['family_acknowledged', 'worker_followup', 'closed']), action: z.string().min(1), actor: z.enum(['family', 'worker']).optional() }).safeParse(await request.json());
  const event = await emergencyEvents.get(id); if (!event) return NextResponse.json({ error: '알림을 찾을 수 없어요.' }, { status: 404 });
  if (!parsed.success) return NextResponse.json({ error: '처리 정보를 확인해 주세요.' }, { status: 400 });
  const updated = await emergencyEvents.update(id, { status: parsed.data.status, actor: actor.role, actorId: actor.id, action: parsed.data.action }); return NextResponse.json(updated);
}
