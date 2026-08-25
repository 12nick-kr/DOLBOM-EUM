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
    client.subscribe((e) => { if (e.type !== 'delete') events.push(`${e.type}:${e.request.id}`); });
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual(['insert:r1']);
    client.dispose();
  });

  it('emits a delete event when a previously known card disappears', async () => {
    const fetchList = vi.fn()
      .mockResolvedValueOnce([card({ id: 'r1' })])
      .mockResolvedValueOnce([]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const events: string[] = [];
    client.subscribe((event) => events.push(event.type === 'delete' ? `delete:${event.id}` : `${event.type}:${event.request.id}`));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual(['insert:r1', 'delete:r1']);
    client.dispose();
  });

  it('emits an update event only when updated_at advances', async () => {
    const fetchList = vi.fn()
      .mockResolvedValueOnce([card({ id: 'r1', updatedAt: '2026-08-25T00:00:00Z' })])
      .mockResolvedValueOnce([card({ id: 'r1', updatedAt: '2026-08-25T00:00:00Z' })])
      .mockResolvedValueOnce([card({ id: 'r1', status: 'in_progress', updatedAt: '2026-08-25T01:00:00Z' })]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const events: string[] = [];
    client.subscribe((e) => { if (e.type !== 'delete') events.push(`${e.type}:${e.request.status}`); });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual(['insert:new', 'update:in_progress']);
    client.dispose();
  });

  it('첫 조회가 성공하기 전에는 연결됨으로 보고하지 않는다', async () => {
    // 서버가 죽어 있어도 최초 1초 동안 "연결됨"으로 보이던 문제 — 낙관적 초기값이 원인이었다.
    const client = new PollingRealtimeClient(vi.fn().mockRejectedValue(new Error('network')), 1000);
    expect(client.connectionState()).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connectionState()).toBe('disconnected');
    client.dispose();
  });

  it('첫 조회가 성공하면 연결됨으로 승격한다', async () => {
    const client = new PollingRealtimeClient(vi.fn().mockResolvedValue([card({ id: 'r1' })]), 1000);
    const states: string[] = [];
    client.onConnectionChange((s) => states.push(s));
    await vi.advanceTimersByTimeAsync(0);
    expect(states).toEqual(['connected']);
    expect(client.connectionState()).toBe('connected');
    client.dispose();
  });

  it('reports disconnected when the poll fails and connected again once it recovers', async () => {
    const fetchList = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([card({ id: 'r1' })]);
    const client = new PollingRealtimeClient(fetchList, 1000);
    const states: string[] = [];
    client.onConnectionChange((s) => states.push(s));
    await vi.advanceTimersByTimeAsync(0);
    // 이미 disconnected로 출발하므로 첫 실패는 상태 변화가 아니다 — 알림도 나가지 않는다.
    expect(states).toEqual([]);
    expect(client.connectionState()).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toEqual(['connected']);
    client.dispose();
  });
});
