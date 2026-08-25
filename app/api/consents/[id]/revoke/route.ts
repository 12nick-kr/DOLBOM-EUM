import { NextRequest, NextResponse } from 'next/server';
import { state } from '@/lib/server/store';
import { authenticatedActor } from '@/lib/server/auth';
import { createSupabaseAdminClient, hasSupabaseAuthEnvironment } from '@/lib/server/supabaseAuth';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '어르신 본인만 동의를 철회할 수 있어요.' }, { status: 403 });
  const { id } = await context.params;
  const revokedAt = new Date().toISOString();

  if (hasSupabaseAuthEnvironment()) {
    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .from('consent_grants')
      .update({ revoked_at: revokedAt })
      .eq('id', id)
      .eq('senior_id', actor.id)
      .select('id, senior_id, grantee_id, scope, expires_at, revoked_at')
      .single();
    if (error || !data) return NextResponse.json({ error: '동의를 찾을 수 없어요.' }, { status: 404 });
    return NextResponse.json({ id: data.id, seniorId: data.senior_id, granteeId: data.grantee_id, scope: data.scope, expiresAt: data.expires_at, revokedAt: data.revoked_at });
  }

  const consent = state.consents.find((item) => item.id === id && item.seniorId === actor.id);
  if (!consent) return NextResponse.json({ error: '동의를 찾을 수 없어요.' }, { status: 404 });
  consent.revokedAt = revokedAt;
  return NextResponse.json(consent);
}
