import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { careRelationships, id, state } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';
import { createSupabaseAdminClient, hasSupabaseAuthEnvironment } from '@/lib/server/supabaseAuth';

export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const seniorIds = actor.role === 'senior' ? [actor.id] : await careRelationships.seniorIdsForMember(actor.id, actor.role);
  if (seniorIds.length === 0) return NextResponse.json({ data: [] });

  if (hasSupabaseAuthEnvironment()) {
    const client = createSupabaseAdminClient();
    let query = client.from('consent_grants').select('id, senior_id, grantee_id, scope, expires_at, revoked_at').in('senior_id', seniorIds);
    if (actor.role === 'family') query = query.eq('grantee_id', actor.id);
    const { data, error } = await query.order('expires_at', { ascending: false });
    if (error) return NextResponse.json({ error: '동의 정보를 불러오지 못했어요.' }, { status: 500 });
    return NextResponse.json({ data: (data ?? []).map((row) => ({ id: row.id, seniorId: row.senior_id, granteeId: row.grantee_id, scope: row.scope, expiresAt: row.expires_at, revokedAt: row.revoked_at })) });
  }

  const data = state.consents.filter((consent) => seniorIds.includes(consent.seniorId) && (actor.role !== 'family' || consent.granteeId === actor.id));
  return NextResponse.json({ data });
}

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
