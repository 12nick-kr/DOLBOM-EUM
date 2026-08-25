import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PollingRealtimeClient } from '@/lib/client/pollingRealtimeClient';
import type { ServiceRequest } from '@/lib/domain/types';

function card(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'r1', seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice',
    details: {}, missingFields: [], status: 'new', assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  };
}

describe('PollingRealtimeClient — runtime bridge without a live Supabase connection', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('emits an insert event for a card seen for the first time', async () => {
    const fetchList = vi.fn().mockResolvedValue([card({ id: 'r1' })]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const events: string[] = [];
    client.subscribe((e) => events.push(`${e.type}:${e.request.id}`));
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual(['insert:r1']);
    client.dispose();
  });

  it('emits an update event only when updated_at advances', async () => {
    const fetchList = vi.fn()
      .mockResolvedValueOnce([card({ id: 'r1', updatedAt: '2026-08-25T00:00:00Z' })])
      .mockResolvedValueOnce([card({ id: 'r1', updatedAt: '2026-08-25T00:00:00Z' })])
      .mockResolvedValueOnce([card({ id: 'r1', status: 'in_progress', updatedAt: '2026-08-25T01:00:00Z' })]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const events: string[] = [];
    client.subscribe((e) => events.push(`${e.type}:${e.request.status}`));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual(['insert:new', 'update:in_progress']);
    client.dispose();
  });

  it('reports disconnected when the poll fails and connected again once it recovers', async () => {
    const fetchList = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([card({ id: 'r1' })]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const states: string[] = [];
    client.onConnectionChange((s) => states.push(s));
    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toEqual(['disconnected']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toEqual(['disconnected', 'connected']);
    client.dispose();
  });
});
