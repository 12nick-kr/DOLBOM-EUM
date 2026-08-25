import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships, serviceRequests } from '@/lib/server/store';

/** 업무 상태와 별개로 사회복지사의 확인 시각을 서버에 남긴다. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '사회복지사만 요청을 확인 처리할 수 있어요.' }, { status: 403 });

  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  const assignedSeniorIds = await careRelationships.seniorIdsForMember(actor.id, 'worker');
  if (!assignedSeniorIds.includes(existing.seniorId)) return NextResponse.json({ error: '담당 관계가 없는 요청이에요.' }, { status: 403 });

  try {
    return NextResponse.json(await serviceRequests.acknowledge(id, actor.id));
  } catch {
    return NextResponse.json({ error: '확인 상태를 저장하지 못했어요.' }, { status: 500 });
  }
}
