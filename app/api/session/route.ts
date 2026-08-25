import { NextRequest, NextResponse } from 'next/server';
import { authenticatedActor } from '@/lib/server/auth';

/** 로그인한 본인의 표시 이름·역할. 화면 인사말이 데모 이름 대신 실제 계정을 쓰도록 하는 최소 정보만 담는다. */
export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ data: { id: actor.id, role: actor.role, displayName: actor.displayName } });
}
