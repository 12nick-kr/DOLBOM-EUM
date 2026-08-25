import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestDetailsSchema, requestInputTypeSchema, requestTypeSchema, urgencySchema } from '@/lib/domain/types';
import { classifyUrgency, detectSafetyRisk } from '@/lib/domain/urgency';
import { authenticatedActor } from '@/lib/server/auth';
import { emergencyEvents, seniorInputs, seniorInputsProvider, serviceRequests } from '@/lib/server/store';

const requestSchema = z.object({
  type: requestTypeSchema,
  summary: z.string().min(1).max(300),
  details: requestDetailsSchema.default({}),
  missingFields: z.array(z.string()).default([]),
  dueAt: z.string().optional(),
});

const bodySchema = z.object({
  transcript: z.string().trim().min(1).max(1000),
  inputType: requestInputTypeSchema,
  idempotencyKey: z.string().min(1).max(200),
  confirmed: z.literal(true),
  request: requestSchema.optional(),
  summary: z.string().min(1).max(300).optional(),
  urgency: urgencySchema.optional(),
}).strict();

/**
 * 노인이 최종 확인한 음성/텍스트를 저장하는 단일 진입점. 클라이언트가 seniorId를 선택할 수
 * 없으며, 입력 이벤트가 먼저 정본으로 남고 서비스 요청 카드는 sourceEventId로 연결된다.
 */
export async function POST(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '노인 본인의 입력만 저장할 수 있어요.' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '최종 확인한 입력 내용을 확인해 주세요.' }, { status: 400 });

  const hardGate = classifyUrgency(parsed.data.transcript);
  const safetyRisk = detectSafetyRisk(parsed.data.transcript);
  const isEmergency = hardGate.urgency === 'emergency';
  const category = isEmergency ? 'emergency' as const : parsed.data.request ? 'service_request' as const : 'daily' as const;
  const urgency = isEmergency ? 'emergency' as const : parsed.data.urgency ?? (parsed.data.request ? 'welfare' as const : 'normal' as const);
  const summary = isEmergency ? hardGate.summary : parsed.data.request?.summary ?? parsed.data.summary ?? '확인한 안부 입력';

  try {
    let event = await seniorInputs.create({
      seniorId: actor.id,
      source: parsed.data.inputType,
      transcript: parsed.data.transcript,
      category,
      urgency,
      summary,
      visibility: isEmergency
        ? { family: 'summary_only', worker: 'full' }
        : parsed.data.request
          ? { family: 'summary_only', worker: 'full' }
          : { family: 'none', worker: 'summary_only' },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    let card = event.serviceRequestId ? await serviceRequests.get(event.serviceRequestId) : undefined;
    if (parsed.data.request && !isEmergency && !card) {
      card = await serviceRequests.create({
        seniorId: actor.id,
        sourceEventId: event.id,
        type: parsed.data.request.type,
        summary: parsed.data.request.summary,
        transcript: parsed.data.transcript,
        inputType: parsed.data.inputType,
        details: parsed.data.request.details,
        missingFields: parsed.data.request.missingFields,
        dueAt: parsed.data.request.dueAt,
        riskLevel: safetyRisk.level,
        riskReasons: safetyRisk.reasons,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      event = await seniorInputs.attachServiceRequest(event.id, card.id);
    }

    let emergency = event.emergencyEventId ? await emergencyEvents.get(event.emergencyEventId) : undefined;
    if (isEmergency && !emergency) {
      emergency = await emergencyEvents.create({ seniorId: actor.id, utterance: parsed.data.transcript, location: '대전광역시 중구 (데모 위치)' });
      event = await seniorInputs.attachEmergency(event.id, emergency.id);
    }

    return NextResponse.json({ event, card: card ?? null, emergency: emergency ?? null, is_demo: seniorInputsProvider === 'in-memory' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '입력을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const actor = await authenticatedActor(request);
  if (!actor) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (actor.role !== 'senior') return NextResponse.json({ error: '입력 원문은 노인 본인만 조회할 수 있어요.' }, { status: 403 });
  const data = await seniorInputs.listForSenior(actor.id);
  return NextResponse.json({ data, is_demo: seniorInputsProvider === 'in-memory' });
}
