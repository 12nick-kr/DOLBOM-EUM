import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmergencyEvent } from '@/lib/domain/types';
import type { CreateEmergencyInput, EmergencyRepository, UpdateEmergencyInput } from './emergencyRepository';

type EmergencyRow = { id: string; senior_id: string; utterance: string | null; location: { label?: string } | string | null; level: string; status: EmergencyEvent['status']; created_at: string };
function mapRow(row: EmergencyRow): EmergencyEvent {
  const location = typeof row.location === 'string' ? row.location : row.location?.label ?? '위치 정보 없음';
  return { id: row.id, seniorId: row.senior_id, utterance: row.utterance ?? '', location, level: 'emergency', status: row.status, createdAt: row.created_at, actions: [] };
}

export class SupabaseEmergencyRepository implements EmergencyRepository {
  constructor(private client: SupabaseClient) {}
  async list() {
    const { data, error } = await this.client.from('emergency_events').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`emergency_events 조회 실패: ${error.message}`);
    return ((data ?? []) as EmergencyRow[]).map(mapRow);
  }
  async get(id: string) {
    const { data, error } = await this.client.from('emergency_events').select('*').eq('id', id).maybeSingle();
    return error || !data ? undefined : mapRow(data as EmergencyRow);
  }
  async create(input: CreateEmergencyInput) {
    const { data, error } = await this.client.from('emergency_events').insert({ senior_id: input.seniorId, utterance: input.utterance, location: { label: input.location }, level: 'emergency', status: 'detected' }).select().single();
    if (error) throw new Error(`emergency_events 생성 실패: ${error.message}`);
    const event = mapRow(data as EmergencyRow);
    event.actions.push({ actor: 'senior', action: '알림 초안 확인', result: '가족·복지사 앱 내 알림 생성', at: event.createdAt });
    return event;
  }
  async update(id: string, input: UpdateEmergencyInput) {
    const { data, error } = await this.client.from('emergency_events').update({ status: input.status }).eq('id', id).select().single();
    if (error) throw new Error(`emergency_events 상태 변경 실패: ${error.message}`);
    const event = mapRow(data as EmergencyRow);
    const reason = input.closeReason ? `긴급 종료: ${input.closeReason}` : '앱 내 처리 상태 반영';
    const { error: auditError } = await this.client.from('audit_logs').insert({ actor_id: input.actorId, action: input.action, resource_type: 'emergency_event', resource_id: id, reason });
    if (auditError) throw new Error(`emergency_events 감사 기록 실패: ${auditError.message}`);
    event.actions.push({ actor: input.actor, action: input.action, result: '앱 내 처리 상태 반영', at: new Date().toISOString() });
    return event;
  }
}
