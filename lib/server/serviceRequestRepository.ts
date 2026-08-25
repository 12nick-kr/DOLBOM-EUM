import { canCancelRequest, canTransitionRequest } from '@/lib/domain/policies';
import type { PersistedRequestStatus, RequestDetails, RequestInputType, RequestType, Role, ServiceRequest } from '@/lib/domain/types';

export type CreateServiceRequestInput = {
  seniorId: string;
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
 * 실제 구현(Supabase Postgres)이 붙기 전까지 테스트와 API route는 이 in-memory fake로 동작한다.
 */
export interface ServiceRequestRepository {
  list(): ServiceRequest[];
  listForSenior(seniorId: string): ServiceRequest[];
  listForAssignee(assigneeId: string): ServiceRequest[];
  get(id: string): ServiceRequest | undefined;
  create(input: CreateServiceRequestInput): ServiceRequest;
  transition(id: string, to: PersistedRequestStatus, opts?: { assigneeId?: string }): ServiceRequest;
  acknowledge(id: string, workerId: string): ServiceRequest;
  cancel(id: string, actor: Role): ServiceRequest;
  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest }) => void): () => void;
}

export class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  private rows: ServiceRequest[] = [];
  private idempotency = new Map<string, string>();
  private listeners = new Set<(event: { type: 'insert' | 'update'; request: ServiceRequest }) => void>();
  private seq = 0;

  constructor(seed: ServiceRequest[] = []) {
    this.rows = [...seed];
  }

  private nextId(): string {
    this.seq += 1;
    return `request-${this.seq}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private emit(event: { type: 'insert' | 'update'; request: ServiceRequest }) {
    for (const listener of this.listeners) listener(event);
  }

  list(): ServiceRequest[] {
    return [...this.rows];
  }

  listForSenior(seniorId: string): ServiceRequest[] {
    return this.rows.filter((row) => row.seniorId === seniorId);
  }

  listForAssignee(assigneeId: string): ServiceRequest[] {
    return this.rows.filter((row) => row.assigneeId === assigneeId);
  }

  get(id: string): ServiceRequest | undefined {
    return this.rows.find((row) => row.id === id);
  }

  create(input: CreateServiceRequestInput): ServiceRequest {
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

  transition(id: string, to: PersistedRequestStatus, opts?: { assigneeId?: string }): ServiceRequest {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!canTransitionRequest(row.status, to)) throw new Error(`허용되지 않은 상태 전이입니다: ${row.status} -> ${to}`);
    row.status = to;
    if (opts?.assigneeId) row.assigneeId = opts.assigneeId;
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  acknowledge(id: string, workerId: string): ServiceRequest {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!row.acknowledgedAt) row.acknowledgedAt = new Date().toISOString();
    if (!row.assigneeId) row.assigneeId = workerId;
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  cancel(id: string, actor: Role): ServiceRequest {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('요청을 찾을 수 없습니다.');
    if (!canCancelRequest(actor, row.status)) throw new Error('이 상태에서는 취소할 수 없습니다.');
    row.status = 'rejected';
    row.updatedAt = new Date().toISOString();
    this.emit({ type: 'update', request: row });
    return row;
  }

  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
