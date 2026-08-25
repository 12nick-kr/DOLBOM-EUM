import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { careRelationships, id, state } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 본인만 정보 공유에 동의할 수 있어요.' }, { status: 403 });
  const data = z.object({
    granteeId: z.string().min(1),
    scope: z.enum(['health', 'location', 'service', 'emergency', 'conversation_summary']),
    expiresAt: z.string().datetime(),
  }).safeParse(await request.json());
  if (!data.success || new Date(data.data.expiresAt).getTime() <= Date.now()) return NextResponse.json({ error: '동의 항목과 만료일을 확인해 주세요.' }, { status: 400 });
  const linkedSeniorIds = await careRelationships.seniorIdsForMember(data.data.granteeId, 'family');
  if (!linkedSeniorIds.includes(actor.id)) return NextResponse.json({ error: '연결된 부양가족에게만 공유할 수 있어요.' }, { status: 403 });
  const consent = { id: id('consent'), seniorId: actor.id, ...data.data, revokedAt: null };
  state.consents.push(consent);
  return NextResponse.json(consent, { status: 201 });
}
