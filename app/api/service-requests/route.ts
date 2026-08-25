import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema, requestTypeSchema } from '@/lib/domain/types';
import { demoSeniorId, serviceRequests } from '@/lib/server/store';

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
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '요청 내용은 본인 확인 후 보낼 수 있어요.' }, { status: 400 });
  const { confirmed: _confirmed, ...input } = parsed.data;
  const created = serviceRequests.create({ seniorId: demoSeniorId, ...input });
  return NextResponse.json({ ...created, is_demo: true }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ data: serviceRequests.list(), is_demo: true });
}
