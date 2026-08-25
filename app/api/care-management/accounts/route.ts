import { NextRequest, NextResponse } from 'next/server';
import { loginIdSchema } from '@/lib/auth/credentials';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships } from '@/lib/server/store';

export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '사회복지사만 계정을 검색할 수 있어요.' }, { status: 403 });
  const parsed = loginIdSchema.safeParse(request.nextUrl.searchParams.get('loginId') ?? '');
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const profile = await careRelationships.findProfileByLoginId(parsed.data);
  return NextResponse.json({ profile: profile ?? null });
}
