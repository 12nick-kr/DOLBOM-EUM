import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships, serviceRequests } from '@/lib/server/store';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '담당 사회복지사만 완료할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  if (!(await careRelationships.seniorIdsForMember(actor.id, 'worker')).includes(existing.seniorId)) return NextResponse.json({ error: '담당 관계가 없는 요청은 완료할 수 없어요.' }, { status: 403 });
  try {
    return NextResponse.json(await serviceRequests.complete(id, actor.id));
  } catch {
    return NextResponse.json({ error: '본인이 담당 중인 요청만 완료할 수 있어요.' }, { status: 409 });
  }
}
