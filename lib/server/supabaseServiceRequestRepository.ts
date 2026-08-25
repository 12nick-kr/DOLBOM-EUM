import type { SupabaseClient } from '@supabase/supabase-js';
import { canCancelRequest, canTransitionRequest } from '@/lib/domain/policies';
import type { PersistedRequestStatus, RequestDetails, Role, ServiceRequest } from '@/lib/domain/types';
import type { CreateServiceRequestInput, ServiceRequestRepository } from './serviceRequestRepository';

const TABLE = 'service_requests';

/** PRD §13 `service_requests` 테이블의 Postgres row 형태 (snake_case). */
type ServiceRequestRow = {
  id: string;
  senior_id: string;
  type: ServiceRequest['type'];
  summary: string;
  transcript: string;
  input_type: ServiceRequest['inputType'];
  details: RequestDetails;
  missing_fields: string[];
  status: PersistedRequestStatus;
  assignee_id: string | null;
  acknowledged_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Postgres row(snake_case) -> 도메인 `ServiceRequest`(camelCase). 어댑터 경계에서만 필요한 순수 매핑 함수라 단위 테스트로 직접 검증한다. */
export function mapRowToServiceRequest(row: ServiceRequestRow): ServiceRequest {
  return {
    id: row.id,
    seniorId: row.senior_id,
    type: row.type,
    summary: row.summary,
    transcript: row.transcript,
    inputType: row.input_type,
    details: row.details ?? {},
    missingFields: row.missing_fields ?? [],
    status: row.status,
    assigneeId: row.assignee_id,
    acknowledgedAt: row.acknowledged_at,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 도메인 생성 입력 -> Postgres insert row(snake_case). */
export function mapCreateInputToRow(input: CreateServiceRequestInput): Record<string, unknown> {
  return {
    senior_id: input.seniorId,
    type: input.type,
    summary: input.summary,
    transcript: input.transcript,
    input_type: input.inputType,
    details: input.details,
    missing_fields: input.missingFields,
    status: 'new',
    due_at: input.dueAt ?? null,
    idempotency_key: input.idempotencyKey,
  };
}

/**
 * 실제 Supabase Postgres 어댑터 (PRD §11.5 표: "운영 구현"). `ServiceRequestRepository` 포트를
 * `InMemoryServiceRequestRepository`와 동일하게 만족하므로, API route는 어느 구현이 주입됐는지
 * 신경 쓰지 않는다. `onChange` 리스너는 로컬 프로세스 이벤트만 전달한다 — 여러 서버 인스턴스/
 * 다른 클라이언트에 걸친 실시간 전파는 Supabase Realtime 어댑터(`RealtimePort`)의 책임이며,
 * 이 저장소는 그 어댑터에 필요한 원본 이벤트를 실제 DB 조작 시점에 로컬로도 발행할 뿐이다.
 */
export class SupabaseServiceRequestRepository implements ServiceRequestRepository {
  private listeners = new Set<(event: { type: 'insert' | 'update'; request: ServiceRequest }) => void>();

  constructor(private client: SupabaseClient) {}

  private emit(event: { type: 'insert' | 'update'; request: ServiceRequest }) {
    for (const listener of this.listeners) listener(event);
  }

  async list(): Promise<ServiceRequest[]> {
    const { data, error } = await this.client.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`service_requests 조회 실패: ${error.message}`);
    return ((data ?? []) as ServiceRequestRow[]).map(mapRowToServiceRequest);
  }

  async listForSenior(seniorId: string): Promise<ServiceRequest[]> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('senior_id', seniorId).order('created_at', { ascending: false });
    if (error) throw new Error(`service_requests 조회 실패: ${error.message}`);
    return ((data ?? []) as ServiceRequestRow[]).map(mapRowToServiceRequest);
  }

  async listForAssignee(assigneeId: string): Promise<ServiceRequest[]> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('assignee_id', assigneeId).order('created_at', { ascending: false });
    if (error) throw new Error(`service_requests 조회 실패: ${error.message}`);
    return ((data ?? []) as ServiceRequestRow[]).map(mapRowToServiceRequest);
  }

  async get(id: string): Promise<ServiceRequest | undefined> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('id', id).single();
    if (error) return undefined;
    return data ? mapRowToServiceRequest(data as ServiceRequestRow) : undefined;
  }

  /**
   * idempotency는 애플리케이션에서 먼저 확인하지 않고 `unique (senior_id, idempotency_key)` 제약
   * (0001_demo_schema.sql)에 위임한다 — 동시 요청에서도 DB가 최종 방어선이 되도록 하기 위함이다.
   * 위반 시(재전송) 기존 행을 다시 조회해 반환한다.
   */
  async create(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    if (!canTransitionRequest('draft', 'new')) throw new Error('draft에서 new로의 전이가 허용되지 않습니다.');
    const row = mapCreateInputToRow(input);
    const { data, error } = await this.client.from(TABLE).insert(row).select().single();
    if (error) {
      // Postgres unique_violation(23505) — 같은 idempotency key 재전송으로 간주하고 기존 행을 반환한다.
      if (error.code === '23505') {
        const { data: existing, error: fetchError } = await this.client
          .from(TABLE)
          .select('*')
          .eq('senior_id', input.seniorId)
          .eq('idempotency_key', input.idempotencyKey)
          .single();
        if (!fetchError && existing) return mapRowToServiceRequest(existing as ServiceRequestRow);
      }
      throw new Error(`service_requests 생성 실패: ${error.message}`);
    }
    const created = mapRowToServiceRequest(data as ServiceRequestRow);
    this.emit({ type: 'insert', request: created });
    return created;
  }

  async transition(id: string, to: PersistedRequestStatus, opts?: { assigneeId?: string }): Promise<ServiceRequest> {
    const existing = await this.get(id);
    if (!existing) throw new Error('요청을 찾을 수 없습니다.');
    if (!canTransitionRequest(existing.status, to)) throw new Error(`허용되지 않은 상태 전이입니다: ${existing.status} -> ${to}`);
    const updates: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() };
    if (opts?.assigneeId) updates.assignee_id = opts.assigneeId;
    const { data, error } = await this.client.from(TABLE).update(updates).eq('id', id).select().single();
    if (error) throw new Error(`service_requests 상태 변경 실패: ${error.message}`);
    const updated = mapRowToServiceRequest(data as ServiceRequestRow);
    this.emit({ type: 'update', request: updated });
    return updated;
  }

  async acknowledge(id: string, workerId: string): Promise<ServiceRequest> {
    const existing = await this.get(id);
    if (!existing) throw new Error('요청을 찾을 수 없습니다.');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!existing.acknowledgedAt) updates.acknowledged_at = new Date().toISOString();
    if (!existing.assigneeId) updates.assignee_id = workerId;
    const { data, error } = await this.client.from(TABLE).update(updates).eq('id', id).select().single();
    if (error) throw new Error(`service_requests 확인 처리 실패: ${error.message}`);
    const updated = mapRowToServiceRequest(data as ServiceRequestRow);
    this.emit({ type: 'update', request: updated });
    return updated;
  }

  async cancel(id: string, actor: Role): Promise<ServiceRequest> {
    const existing = await this.get(id);
    if (!existing) throw new Error('요청을 찾을 수 없습니다.');
    if (!canCancelRequest(actor, existing.status)) throw new Error('이 상태에서는 취소할 수 없습니다.');
    const { data, error } = await this.client.from(TABLE).update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`service_requests 취소 실패: ${error.message}`);
    const updated = mapRowToServiceRequest(data as ServiceRequestRow);
    this.emit({ type: 'update', request: updated });
    return updated;
  }

  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
