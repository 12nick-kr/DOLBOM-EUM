import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema, requestTypeSchema } from '@/lib/domain/types';
import { authenticatedActor } from '@/lib/server/auth';
import { serviceRequests } from '@/lib/server/store';
import { getVisibleRequests } from '@/lib/server/serviceRequestVisibility';

const createSchema = z.object({
  type: requestTypeSchema,
  summary: z.string().min(1),
  transcript: z.string().min(1),
  inputType: requestInputTypeSchema,
  details: requestDetailsSchema.default({}),
  missingFields: z.array(z.string()).default([]),
  idempotencyKey: z.string().min(1),
  dueAt: z.string().optional(),
  confirmed: z.literal(true),
});

export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '노인 본인만 요청을 만들 수 있어요.' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '요청 내용은 본인 확인 후 보낼 수 있어요.' }, { status: 400 });
  const { confirmed: _confirmed, ...input } = parsed.data;
  const created = await serviceRequests.create({ seniorId: actor.id, ...input });
  return NextResponse.json({ ...created, is_demo: true }, { status: 201 });
}

/**
 * 역할에 따라 허용된 카드만 반환한다(PRD §7.4/§11.4). 실시간 구독의 초기 상태·재동기화용이며,
 * 실시간이 완전히 꺼져 있어도 이 조회만으로 같은 데이터를 볼 수 있어야 한다(FR-08).
 */
export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const data = await getVisibleRequests(actor);
  return NextResponse.json({ data, is_demo: true });
}
