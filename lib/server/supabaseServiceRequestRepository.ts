import type { SupabaseClient } from '@supabase/supabase-js';
import { canCancelRequest, canTransitionRequest } from '@/lib/domain/policies';
import type { PersistedRequestStatus, RequestDetails, Role, ServiceRequest } from '@/lib/domain/types';
import type { CreateServiceRequestInput, ServiceRequestRepository } from './serviceRequestRepository';
import { serviceDateFor } from '@/lib/domain/requestSchedule';

const TABLE = 'service_requests';

/** PRD §13 `service_requests` 테이블의 Postgres row 형태 (snake_case). */
type ServiceRequestRow = {
  id: string;
  senior_id: string;
  source_event_id?: string | null;
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
  service_date?: string | null;
  schedule_timezone?: 'Asia/Seoul' | null;
  completed_at?: string | null;
  completed_by?: string | null;
  memo?: string | null;
  created_at: string;
  updated_at: string;
};

/** Postgres row(snake_case) -> 도메인 `ServiceRequest`(camelCase). 어댑터 경계에서만 필요한 순수 매핑 함수라 단위 테스트로 직접 검증한다. */
export function mapRowToServiceRequest(row: ServiceRequestRow): ServiceRequest {
  return {
    id: row.id,
    seniorId: row.senior_id,
    sourceEventId: row.source_event_id ?? null,
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
    serviceDate: row.service_date ?? null,
    scheduleTimezone: row.schedule_timezone ?? 'Asia/Seoul',
    completedAt: row.completed_at ?? null,
    completedBy: row.completed_by ?? null,
    memo: row.memo ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 도메인 생성 입력 -> Postgres insert row(snake_case). */
export function mapCreateInputToRow(input: CreateServiceRequestInput): Record<string, unknown> {
  return {
    senior_id: input.seniorId,
    source_event_id: input.sourceEventId ?? null,
    type: input.type,
    summary: input.summary,
    transcript: input.transcript,
    input_type: input.inputType,
    details: input.details,
    missing_fields: input.missingFields,
    status: 'new',
    due_at: input.dueAt ?? null,
    service_date: input.serviceDate ?? serviceDateFor(input.details, input.dueAt),
    schedule_timezone: 'Asia/Seoul',
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
  private listeners = new Set<(event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) => void>();

  constructor(private client: SupabaseClient) {}

  private emit(event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) {
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
    if (to === 'in_progress' && opts?.assigneeId) {
      await this.client.from('audit_logs').insert({ actor_id: opts.assigneeId, action: 'service_request.assigned', resource_type: 'service_request', resource_id: id, reason: '담당 맡기 버튼' });
    }
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

  async complete(id: string, workerId: string): Promise<ServiceRequest> {
    const existing = await this.get(id);
    if (!existing || existing.status !== 'in_progress' || existing.assigneeId !== workerId) throw new Error('담당 중인 요청만 완료할 수 있습니다.');
    const now = new Date().toISOString();
    const { data, error } = await this.client.from(TABLE).update({ status: 'done', completed_at: now, completed_by: workerId, updated_at: now }).eq('id', id).eq('status', 'in_progress').eq('assignee_id', workerId).select().single();
    if (error) throw new Error(`service_requests 완료 처리 실패: ${error.message}`);
    await this.client.from('audit_logs').insert({ actor_id: workerId, action: 'service_request.completed', resource_type: 'service_request', resource_id: id, reason: '담당 사회복지사 완료 버튼' });
    const updated = mapRowToServiceRequest(data as ServiceRequestRow);
    this.emit({ type: 'update', request: updated });
    return updated;
  }

  async updateMemo(id: string, memo: string): Promise<ServiceRequest> {
    const { data, error } = await this.client.from(TABLE).update({ memo, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`service_requests 메모 저장 실패: ${error.message}`);
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

  async delete(id: string, actorId: string): Promise<ServiceRequest> {
    const { data, error } = await this.client.rpc('delete_service_request_with_source', {
      p_request_id: id,
      p_actor_id: actorId,
    });
    if (error || !data) throw new Error(`service_requests 삭제 실패: ${error?.message ?? '요청을 찾을 수 없습니다.'}`);
    const deleted = mapRowToServiceRequest(data as ServiceRequestRow);
    const deletedAt = new Date().toISOString();
    this.emit({ type: 'delete', id, seniorId: deleted.seniorId, deletedAt });
    return deleted;
  }

  onChange(listener: (event: { type: 'insert' | 'update'; request: ServiceRequest } | { type: 'delete'; id: string; seniorId: string; deletedAt: string }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
