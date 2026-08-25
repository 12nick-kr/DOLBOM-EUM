import { describe, expect, it, vi } from 'vitest';
import { mapRowToServiceRequest, mapCreateInputToRow, SupabaseServiceRequestRepository } from '@/lib/server/supabaseServiceRequestRepository';
import type { ServiceRequest } from '@/lib/domain/types';

const sampleRow = {
  id: 'row-1',
  senior_id: 'senior-demo-001',
  type: 'hospital_escort' as const,
  summary: '병원 동행 도움이 필요해요.',
  transcript: '다음 주 화요일 병원에 같이 갈 사람이 필요해요.',
  input_type: 'voice' as const,
  details: { destination: '충남대학교병원', desiredAt: '2026-09-01T10:00:00+09:00', needsTransportHelp: true },
  missing_fields: [] as string[],
  status: 'new' as const,
  assignee_id: null as string | null,
  acknowledged_at: null as string | null,
  due_at: '2026-09-01T10:00:00+09:00' as string | null,
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
};

describe('mapRowToServiceRequest — Postgres row -> domain ServiceRequest (PRD §13)', () => {
  it('maps snake_case Postgres columns to the camelCase domain shape', () => {
    const mapped = mapRowToServiceRequest(sampleRow);
    expect(mapped).toEqual<ServiceRequest>({
      id: 'row-1',
      seniorId: 'senior-demo-001',
      sourceEventId: null,
      type: 'hospital_escort',
      summary: '병원 동행 도움이 필요해요.',
      transcript: '다음 주 화요일 병원에 같이 갈 사람이 필요해요.',
      inputType: 'voice',
      details: { destination: '충남대학교병원', desiredAt: '2026-09-01T10:00:00+09:00', needsTransportHelp: true },
      missingFields: [],
      status: 'new',
      assigneeId: null,
      acknowledgedAt: null,
      dueAt: '2026-09-01T10:00:00+09:00',
      createdAt: '2026-08-25T00:00:00Z',
      updatedAt: '2026-08-25T00:00:00Z',
    });
  });

  it('maps a null assignee/acknowledged_at/due_at correctly', () => {
    const mapped = mapRowToServiceRequest({ ...sampleRow, assignee_id: 'worker-1', acknowledged_at: '2026-08-25T01:00:00Z', due_at: null });
    expect(mapped.assigneeId).toBe('worker-1');
    expect(mapped.acknowledgedAt).toBe('2026-08-25T01:00:00Z');
    expect(mapped.dueAt).toBeUndefined();
  });
});

describe('mapCreateInputToRow — domain create input -> Postgres insert row', () => {
  it('produces snake_case columns including the idempotency key', () => {
    const row = mapCreateInputToRow({
      seniorId: 'senior-demo-001',
      type: 'welfare_info',
      summary: '요약',
      transcript: '원문',
      inputType: 'text',
      details: {},
      missingFields: [],
      idempotencyKey: 'key-1',
    });
    expect(row).toMatchObject({
      senior_id: 'senior-demo-001',
      type: 'welfare_info',
      summary: '요약',
      transcript: '원문',
      input_type: 'text',
      details: {},
      missing_fields: [],
      status: 'new',
      idempotency_key: 'key-1',
    });
  });
});

/** Supabase client의 최소 인터페이스만 흉내 내는 fake — 실제 네트워크를 전혀 쓰지 않는다. */
function fakeSupabaseClient(rows: Record<string, unknown>[]) {
  const state = { rows: [...rows] };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn((values: Record<string, unknown>) => {
      const inserted = { id: `generated-${state.rows.length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...values };
      state.rows.push(inserted);
      return { select: () => ({ single: async () => ({ data: inserted, error: null }) }) };
    }),
    update: vi.fn((values: Record<string, unknown>) => ({
      eq: (_col: string, id: string) => {
        const row = state.rows.find((r) => r.id === id);
        if (row) Object.assign(row, values);
        return { select: () => ({ single: async () => ({ data: row ?? null, error: row ? null : { message: 'not found' } }) }) };
      },
    })),
    then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) => resolve({ data: state.rows, error: null }),
  };
  return { from: vi.fn(() => builder), _state: state };
}

describe('SupabaseServiceRequestRepository — satisfies the ServiceRequestRepository port', () => {
  it('list() returns rows mapped to domain ServiceRequest shape', async () => {
    const client = fakeSupabaseClient([sampleRow]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseServiceRequestRepository(client as any);
    const list = await repo.list();
    expect(list[0].seniorId).toBe('senior-demo-001');
    expect(list[0].id).toBe('row-1');
  });
});
