import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships } from '@/lib/server/store';

export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '사회복지사만 연결을 관리할 수 있어요.' }, { status: 403 });
  return NextResponse.json({ data: await careRelationships.groupsForWorker(actor.id) });
}
