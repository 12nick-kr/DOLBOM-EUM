import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema, requestTypeSchema } from '@/lib/domain/types';
import { redactForRole } from '@/lib/domain/policies';
import { demoActor } from '@/lib/server/auth';
import { demoSeniorId, demoWorkerId, seniorIdsAssignedTo, serviceRequests } from '@/lib/server/store';

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
  const created = await serviceRequests.create({ seniorId: demoSeniorId, ...input });
  return NextResponse.json({ ...created, is_demo: true }, { status: 201 });
}

/**
 * 역할에 따라 허용된 카드만 반환한다(PRD §7.4/§11.4). 실시간 구독의 초기 상태·재동기화용이며,
 * 실시간이 완전히 꺼져 있어도 이 조회만으로 같은 데이터를 볼 수 있어야 한다(FR-08).
 */
export async function GET(request: NextRequest) {
  const actor = demoActor(request);
  const all = await serviceRequests.list();
  const scoped = actor.role === 'senior'
    ? await serviceRequests.listForSenior(actor.id)
    : actor.role === 'worker'
      ? all.filter((row) => seniorIdsAssignedTo(actor.id).includes(row.seniorId))
      : all.filter((row) => seniorIdsAssignedTo(demoWorkerId).includes(row.seniorId) || row.seniorId === demoSeniorId);
  // 가족 화면에는 별도 동의(transcriptConsent) 없이는 원문을 노출하지 않는다.
  const data = scoped.map((row) => redactForRole(row, actor.role, { transcriptConsent: false }));
  return NextResponse.json({ data, is_demo: true });
}
