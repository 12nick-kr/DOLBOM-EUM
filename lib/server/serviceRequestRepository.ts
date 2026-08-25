import { canCancelRequest, canTransitionRequest } from '@/lib/domain/policies';
import type { PersistedRequestStatus, RequestDetails, RequestInputType, RequestType, Role, ServiceRequest } from '@/lib/domain/types';

export type CreateServiceRequestInput = {
  seniorId: string;
  sourceEventId?: string;
  type: RequestType;
  summary: string;
  transcript: string;
  inputType: RequestInputType;
  details: RequestDetails;
  missingFields: string[];
  idempotencyKey: string;
  dueAt?: string;
};

/**
 * 요청 카드 정본 저장소 포트. PRD §11.4/TDD §3.9: 실시간은 최적화이고 정본은 항상 이 저장소의 조회다.
 * PRD §11.5(v1.4)부터 Supabase Postgres 어댑터(`SupabaseServiceRequestRepository`)가 자격증명이
 * 있을 때의 운영 구현이다 — 모든 메서드가 `Promise`를 반환하는 이유는 실제 DB 왕복을 반영하기
 * 위함이며, `InMemoryServiceRequestRepository`는 동기 로직을 `Promise.resolve`로 감싸 같은
 * 인터페이스를 만족한다(테스트는 여전히 실제 네트워크 없이 즉시 resolve된다).
 */
export interface ServiceRequestRepository {
  list(): Promise<ServiceRequest[]>;
  listForSenior(seniorId: string): Promise<ServiceRequest[]>;
  listForAssignee(assigneeId: string): Promise<ServiceRequest[]>;
  get(id: string): Promise<ServiceRequest | undefined>;
  create(input: CreateServiceRequestInput): Promise<ServiceRequest>;
  transition(id: string, to: PersistedRequestStatus, opts?: { assigneeId?: string }): Promise<ServiceRequest>;
  acknowledge(id: string, workerId: string): Promise<ServiceRequest>;
  cancel(id: string, actor: Role): Promise<ServiceRequest>;
  delete(id: string, actorId: string): Promise<ServiceRequest>;
  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) => void): () => void;
}

export class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  private rows: ServiceRequest[] = [];
  private idempotency = new Map<string, string>();
  private listeners = new Set<(event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) => void>();
  private seq = 0;

  constructor(seed: ServiceRequest[] = []) {
    this.rows = [...seed];
  }

  private nextId(): string {
    this.seq += 1;
    return `request-${this.seq}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private emit(event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) {
    for (const listener of this.listeners) listener(event);
  }

  async list(): Promise<ServiceRequest[]> {
    return [...this.rows];
  }

  async listForSenior(seniorId: string): Promise<ServiceRequest[]> {
    return this.rows.filter((row) => row.seniorId === seniorId);
  }

  async listForAssignee(assigneeId: string): Promise<ServiceRequest[]> {
    return this.rows.filter((row) => row.assigneeId === assigneeId);
  }

  async get(id: string): Promise<ServiceRequest | undefined> {
    return this.rows.find((row) => row.id === id);
  }

  async create(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const existingId = this.idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.rows.find((row) => row.id === existingId);
      if (existing) return existing;
    }
    if (!canTransitionRequest('draft', 'new')) throw new Error('draft에서 new로의 전이가 허용되지 않습니다.');
    const now = new Date().toISOString();
    const created: ServiceRequest = {
      id: this.nextId(),
      seniorId: input.seniorId,
      sourceEventId: input.sourceEventId ?? null,
      type: input.type,
      summary: input.summary,
      transcript: input.transcript,
      inputType: input.inputType,
      details: input.details,
      missingFields: input.missingFields,
      status: 'new',
      assigneeId: null,
      acknowledgedAt: null,
      dueAt: input.dueAt,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.unshift(created);
    this.idempotency.set(input.idempotencyKey, created.id);
    this.emit({ type: 'insert', request: created });
    return created;
  }

  async transition(id: string, to: PersistedRequestStatus, opts?: { assigneeId?: string }): Promise<ServiceRequest> {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!canTransitionRequest(row.status, to)) throw new Error(`허용되지 않은 상태 전이입니다: ${row.status} -> ${to}`);
    row.status = to;
    if (opts?.assigneeId) row.assigneeId = opts.assigneeId;
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  async acknowledge(id: string, workerId: string): Promise<ServiceRequest> {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!row.acknowledgedAt) row.acknowledgedAt = new Date().toISOString();
    if (!row.assigneeId) row.assigneeId = workerId;
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  async cancel(id: string, actor: Role): Promise<ServiceRequest> {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!canCancelRequest(actor, row.status)) throw new Error('이 상태에서는 취소할 수 없습니다.');
    row.status = 'rejected';
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  async delete(id: string, _actorId: string): Promise<ServiceRequest> {
    const index = this.rows.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('요청을 찾을 수 없습니다.');
    const [deleted] = this.rows.splice(index, 1);
    for (const [key, requestId] of this.idempotency.entries()) {
      if (requestId === id) this.idempotency.delete(key);
    }
    this.emit({ type: 'delete', id, seniorId: deleted.seniorId, deletedAt: new Date().toISOString() });
    return deleted;
  }

  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
