import type { InputVisibility, RequestInputType, SeniorInputCategory, SeniorInputEvent, Urgency } from '@/lib/domain/types';

export type CreateSeniorInputInput = {
  seniorId: string;
  source: RequestInputType;
  transcript: string;
  category: SeniorInputCategory;
  urgency: Urgency;
  summary: string;
  visibility: InputVisibility;
  idempotencyKey: string;
};

export interface SeniorInputRepository {
  create(input: CreateSeniorInputInput): Promise<SeniorInputEvent>;
  get(id: string): Promise<SeniorInputEvent | undefined>;
  findByIdempotencyKey(seniorId: string, key: string): Promise<SeniorInputEvent | undefined>;
  listForSenior(seniorId: string): Promise<SeniorInputEvent[]>;
  attachServiceRequest(eventId: string, requestId: string): Promise<SeniorInputEvent>;
  attachEmergency(eventId: string, emergencyId: string): Promise<SeniorInputEvent>;
}

export class InMemorySeniorInputRepository implements SeniorInputRepository {
  private rows: SeniorInputEvent[] = [];
  private idempotency = new Map<string, string>();

  async create(input: CreateSeniorInputInput): Promise<SeniorInputEvent> {
    const dedupeKey = `${input.seniorId}:${input.idempotencyKey}`;
    const existingId = this.idempotency.get(dedupeKey);
    if (existingId) return this.rows.find((row) => row.id === existingId)!;
    const now = new Date().toISOString();
    const event: SeniorInputEvent = {
      schemaVersion: 1,
      id: `input-${crypto.randomUUID()}`,
      seniorId: input.seniorId,
      source: input.source,
      transcript: input.transcript,
      category: input.category,
      urgency: input.urgency,
      summary: input.summary,
      serviceRequestId: null,
      emergencyEventId: null,
      visibility: input.visibility,
      confirmedAt: now,
      createdAt: now,
    };
    this.rows.unshift(event);
    this.idempotency.set(dedupeKey, event.id);
    return event;
  }

  async get(id: string): Promise<SeniorInputEvent | undefined> {
    return this.rows.find((row) => row.id === id);
  }

  async findByIdempotencyKey(seniorId: string, key: string): Promise<SeniorInputEvent | undefined> {
    const id = this.idempotency.get(`${seniorId}:${key}`);
    return id ? this.get(id) : undefined;
  }

  async listForSenior(seniorId: string): Promise<SeniorInputEvent[]> {
    return this.rows.filter((row) => row.seniorId === seniorId);
  }

  async attachServiceRequest(eventId: string, requestId: string): Promise<SeniorInputEvent> {
    const row = this.rows.find((item) => item.id === eventId);
    if (!row) throw new Error('노인 입력 이벤트를 찾을 수 없습니다.');
    row.serviceRequestId = requestId;
    return row;
  }

  async attachEmergency(eventId: string, emergencyId: string): Promise<SeniorInputEvent> {
    const row = this.rows.find((item) => item.id === eventId);
    if (!row) throw new Error('노인 입력 이벤트를 찾을 수 없습니다.');
    row.emergencyEventId = emergencyId;
    return row;
  }

  reset(): void {
    this.rows = [];
    this.idempotency.clear();
  }
}
