import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
export async function DELETE(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 본인만 문서를 삭제할 수 있어요.' }, { status: 403 });
  return NextResponse.json({ deleted: true, is_demo: true, audit: '데모 문서 삭제 요청 기록' });
}
