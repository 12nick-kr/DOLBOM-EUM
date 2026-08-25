import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canTransitionRequest } from '@/lib/domain/policies';
import { requestStatusSchema } from '@/lib/domain/types';
import { state } from '@/lib/server/store';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const parsed = z.object({ status: requestStatusSchema, assignee: z.string().optional(), memo: z.string().max(500).optional() }).safeParse(await request.json()); const item = state.requests.find((row) => row.id === id); if (!item) return NextResponse.json({ error: '요청을 찾을 수 없어요.' }, { status: 404 }); if (!parsed.success || !canTransitionRequest(item.status, parsed.data.status)) return NextResponse.json({ error: '허용되지 않은 상태 변경이에요.' }, { status: 400 }); item.status = parsed.data.status; item.assignee = parsed.data.assignee ?? item.assignee; item.updatedAt = new Date().toISOString(); return NextResponse.json(item); }
