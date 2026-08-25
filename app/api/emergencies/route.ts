import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { demoActor } from '@/lib/server/auth';
import { demoSeniorId, emergencyEvents, emergencyEventsProvider, seniorIdsAssignedTo } from '@/lib/server/store';
export async function POST(request: NextRequest) {
  const parsed = z.object({ utterance: z.string().min(1), location: z.string().default('위치 정보 없음'), confirmed: z.literal(true) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '긴급 알림은 본인 확인 후에만 만들 수 있어요.' }, { status: 400 });
  const event = await emergencyEvents.create({ seniorId: demoSeniorId, utterance: parsed.data.utterance, location: parsed.data.location });
  return NextResponse.json({ ...event, is_demo: emergencyEventsProvider === 'in-memory' }, { status: 201 });
}
export async function GET(request: NextRequest) {
  const actor = demoActor(request);
  const all = await emergencyEvents.list();
  const data = actor.role === 'senior'
    ? all.filter((event) => event.seniorId === actor.id)
    : actor.role === 'worker'
      ? all.filter((event) => seniorIdsAssignedTo(actor.id).includes(event.seniorId))
      : all.filter((event) => event.seniorId === demoSeniorId);
  return NextResponse.json({ data, is_demo: emergencyEventsProvider === 'in-memory' });
}
