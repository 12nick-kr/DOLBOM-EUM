import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships, serviceRequests } from '@/lib/server/store';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 요청을 맡을 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(existing.seniorId)) return NextResponse.json({ error: '담당 관계가 없는 요청은 맡을 수 없어요.' }, { status: 403 });
  try {
    return NextResponse.json(await serviceRequests.transition(id, 'in_progress', { assigneeId: actor.id }));
  } catch {
    return NextResponse.json({ error: '신규 요청만 담당할 수 있어요.' }, { status: 409 });
  }
}
