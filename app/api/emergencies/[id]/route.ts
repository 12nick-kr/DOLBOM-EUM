import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { state } from '@/lib/server/store';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const parsed = z.object({ actor: z.enum(['family', 'worker']), status: z.enum(['family_acknowledged', 'worker_followup', 'closed']), action: z.string().min(1) }).safeParse(await request.json());
  const event = state.emergencies.find((item) => item.id === id); if (!event) return NextResponse.json({ error: '알림을 찾을 수 없어요.' }, { status: 404 });
  if (!parsed.success) return NextResponse.json({ error: '처리 정보를 확인해 주세요.' }, { status: 400 });
  event.status = parsed.data.status; event.actions.push({ actor: parsed.data.actor, action: parsed.data.action, result: '앱 내 처리 상태 반영', at: new Date().toISOString() }); return NextResponse.json(event);
}
