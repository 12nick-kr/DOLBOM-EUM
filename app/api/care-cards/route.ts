import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { persistedRequestStatusSchema } from '@/lib/domain/types';
import { authenticatedActor } from '@/lib/server/auth';
import { getVisibleRequests } from '@/lib/server/serviceRequestVisibility';

const querySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: persistedRequestStatusSchema.optional(),
});

/** 역할·관계·동의 범위가 적용된 공통 카드 피드. 커서 기반으로 다수 노인까지 확장한다. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: '카드 조회 조건을 확인해 주세요.' }, { status: 400 });
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  const visible = await getVisibleRequests(actor);
  const filtered = visible
    .filter((card) => !parsed.data.status || card.status === parsed.data.status)
    .filter((card) => !parsed.data.cursor || card.createdAt < parsed.data.cursor);
  const data = filtered.slice(0, parsed.data.limit);
  const nextCursor = filtered.length > parsed.data.limit ? data.at(-1)?.createdAt ?? null : null;
  return NextResponse.json({ data, nextCursor, is_demo: true });
}
