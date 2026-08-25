import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { persistedRequestStatusSchema } from '@/lib/domain/types';
import { serviceRequests } from '@/lib/server/store';

const patchSchema = z.object({
  status: persistedRequestStatusSchema,
  assigneeId: z.string().optional(),
  memo: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = await serviceRequests.get(id);
  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '요청 내용을 확인해 주세요.' }, { status: 400 });
  try {
    const updated = await serviceRequests.transition(id, parsed.data.status, { assigneeId: parsed.data.assigneeId });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '허용되지 않은 상태 변경이에요.' }, { status: 400 });
  }
}
