import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';
export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  return NextResponse.json({ error: '데모에서는 합성 문서의 인증 다운로드를 제공하지 않아요.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
}
