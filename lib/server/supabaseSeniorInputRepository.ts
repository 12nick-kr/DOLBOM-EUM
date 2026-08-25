import type { SupabaseClient } from '@supabase/supabase-js';
import type { InputVisibility, SeniorInputEvent } from '@/lib/domain/types';
import type { CreateSeniorInputInput, SeniorInputRepository } from './seniorInputRepository';

type SeniorInputRow = {
  id: string;
  schema_version: number;
  senior_id: string;
  source: SeniorInputEvent['source'];
  transcript: string;
  category: SeniorInputEvent['category'];
  urgency: SeniorInputEvent['urgency'];
  summary: string;
  service_request_id: string | null;
  emergency_event_id?: string | null;
  visibility: InputVisibility;
  confirmed_at: string;
  created_at: string;
};

export function mapRowToSeniorInputEvent(row: SeniorInputRow): SeniorInputEvent {
  return {
    schemaVersion: 1, id: row.id, seniorId: row.senior_id, source: row.source,
    transcript: row.transcript, category: row.category, urgency: row.urgency, summary: row.summary,
    serviceRequestId: row.service_request_id, emergencyEventId: row.emergency_event_id ?? null, visibility: row.visibility,
    confirmedAt: row.confirmed_at, createdAt: row.created_at,
  };
}

export class SupabaseSeniorInputRepository implements SeniorInputRepository {
  constructor(private client: SupabaseClient) {}

  async create(input: CreateSeniorInputInput): Promise<SeniorInputEvent> {
    const row = {
      schema_version: 1, senior_id: input.seniorId, source: input.source, transcript: input.transcript,
      category: input.category, urgency: input.urgency, summary: input.summary, visibility: input.visibility,
      idempotency_key: input.idempotencyKey,
    };
    const { data, error } = await this.client.from('senior_input_events').insert(row).select().single();
    if (error?.code === '23505') {
      const existing = await this.findByIdempotencyKey(input.seniorId, input.idempotencyKey);
      if (existing) return existing;
    }
    if (error) throw new Error(`senior_input_events 생성 실패: ${error.message}`);
    return mapRowToSeniorInputEvent(data as SeniorInputRow);
  }

  async get(id: string): Promise<SeniorInputEvent | undefined> {
    const { data, error } = await this.client.from('senior_input_events').select('*').eq('id', id).maybeSingle();
    return error || !data ? undefined : mapRowToSeniorInputEvent(data as SeniorInputRow);
  }

  async findByIdempotencyKey(seniorId: string, key: string): Promise<SeniorInputEvent | undefined> {
    const { data, error } = await this.client.from('senior_input_events').select('*').eq('senior_id', seniorId).eq('idempotency_key', key).maybeSingle();
    return error || !data ? undefined : mapRowToSeniorInputEvent(data as SeniorInputRow);
  }

  async listForSenior(seniorId: string): Promise<SeniorInputEvent[]> {
    const { data, error } = await this.client.from('senior_input_events').select('*').eq('senior_id', seniorId).order('created_at', { ascending: false });
    if (error) throw new Error(`senior_input_events 조회 실패: ${error.message}`);
    return ((data ?? []) as SeniorInputRow[]).map(mapRowToSeniorInputEvent);
  }

  async attachServiceRequest(eventId: string, requestId: string): Promise<SeniorInputEvent> {
    const { data, error } = await this.client.from('senior_input_events').update({ service_request_id: requestId }).eq('id', eventId).select().single();
    if (error) throw new Error(`senior_input_events 연결 실패: ${error.message}`);
    return mapRowToSeniorInputEvent(data as SeniorInputRow);
  }

  async attachEmergency(eventId: string, emergencyId: string): Promise<SeniorInputEvent> {
    const { data, error } = await this.client.from('senior_input_events').update({ emergency_event_id: emergencyId }).eq('id', eventId).select().single();
    if (error) throw new Error(`senior_input_events 긴급 연결 실패: ${error.message}`);
    return mapRowToSeniorInputEvent(data as SeniorInputRow);
  }
}
