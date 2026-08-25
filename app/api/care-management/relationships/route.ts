import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedActor } from '@/lib/server/auth';
import { careRelationships } from '@/lib/server/store';

const linkSchema = z.discriminatedUnion('relationshipType', [
  z.object({ relationshipType: z.literal('worker'), seniorId: z.string().min(1) }),
  z.object({ relationshipType: z.literal('family'), seniorId: z.string().min(1), memberId: z.string().min(1) }),
]);
const unlinkSchema = z.object({ seniorId: z.string().min(1), memberId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '사회복지사만 연결을 만들 수 있어요.' }, { status: 403 });
  const parsed = linkSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '연결할 계정을 확인해 주세요.' }, { status: 400 });
  try {
    const relationship = await careRelationships.link({
      actorId: actor.id,
      seniorId: parsed.data.seniorId,
      memberId: parsed.data.relationshipType === 'worker' ? actor.id : parsed.data.memberId,
      relationshipType: parsed.data.relationshipType,
    });
    return NextResponse.json(relationship, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '계정을 연결하지 못했어요.' }, { status: 403 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'worker') return NextResponse.json({ error: '사회복지사만 연결을 해제할 수 있어요.' }, { status: 403 });
  const parsed = unlinkSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '해제할 연결을 확인해 주세요.' }, { status: 400 });
  try {
    await careRelationships.unlink({ actorId: actor.id, ...parsed.data });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '연결을 해제하지 못했어요.' }, { status: 403 });
  }
}
