import { NextRequest, NextResponse } from 'next/server';
import { state } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 본인만 동의를 철회할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const consent = state.consents.find((item) => item.id === id && item.seniorId === actor.id);
  if (!consent) return NextResponse.json({ error: '동의를 찾을 수 없어요.' }, { status: 404 });
  consent.revokedAt = new Date().toISOString();
  return NextResponse.json(consent);
}
