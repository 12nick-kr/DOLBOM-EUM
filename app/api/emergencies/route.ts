import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships, emergencyEvents, emergencyEventsProvider } from '@/lib/server/store';
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '노인 본인만 긴급 알림을 만들 수 있어요.' }, { status: 403 });
  const parsed = z.object({ utterance: z.string().min(1), location: z.string().default('위치 정보 없음'), confirmed: z.literal(true) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '긴급 알림은 본인 확인 후에만 만들 수 있어요.' }, { status: 400 });
  const event = await emergencyEvents.create({ seniorId: actor.id, utterance: parsed.data.utterance, location: parsed.data.location });
  return NextResponse.json({ ...event, is_demo: emergencyEventsProvider === 'in-memory' }, { status: 201 });
}
export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const all = await emergencyEvents.list();
  const linkedSeniorIds = actor.role === 'senior' ? [] : await careRelationships.seniorIdsForMember(actor.id, actor.role);
  const data = actor.role === 'senior'
    ? all.filter((event) => event.seniorId === actor.id)
    : all.filter((event) => linkedSeniorIds.includes(event.seniorId));
  return NextResponse.json({ data, is_demo: emergencyEventsProvider === 'in-memory' });
}
