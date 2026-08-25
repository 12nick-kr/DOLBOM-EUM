import { describe, expect, it } from 'vitest';
import { InMemoryRealtimeAdapter } from '@/lib/server/realtime';
import type { ServiceRequest } from '@/lib/domain/types';

function card(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'r1', seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice',
    details: {}, missingFields: [], status: 'new', assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  };
}

describe('in-memory realtime adapter (PRD §11.4, TDD §3.9)', () => {
  it('delivers an insert event only to a subscription scoped to the matching senior set', () => {
    const adapter = new InMemoryRealtimeAdapter();
    const received: ServiceRequest[] = [];
    const unrelated: ServiceRequest[] = [];
    adapter.subscribe({ seniorIds: ['senior-1'] }, (event) => received.push(event.request));
    adapter.subscribe({ seniorIds: ['senior-2'] }, (event) => unrelated.push(event.request));

    adapter.publish({ type: 'insert', request: card({ seniorId: 'senior-1' }) });

    expect(received).toHaveLength(1);
    expect(unrelated).toHaveLength(0);
  });

  it('does not subscribe a worker with no assigned relationship to any events at all (no client-side filtering fallback)', () => {
    const adapter = new InMemoryRealtimeAdapter();
    const received: ServiceRequest[] = [];
    adapter.subscribe({ seniorIds: [] }, (event) => received.push(event.request));
    adapter.publish({ type: 'insert', request: card({ seniorId: 'senior-1' }) });
    expect(received).toHaveLength(0);
  });

  it('lets a subscriber unsubscribe and stop receiving events', () => {
    const adapter = new InMemoryRealtimeAdapter();
    const received: ServiceRequest[] = [];
    const unsubscribe = adapter.subscribe({ seniorIds: ['senior-1'] }, (event) => received.push(event.request));
    unsubscribe();
    adapter.publish({ type: 'insert', request: card({ seniorId: 'senior-1' }) });
    expect(received).toHaveLength(0);
  });

  it('reports connection state changes so the UI can show disconnect/reconnect status', () => {
    const adapter = new InMemoryRealtimeAdapter();
    const states: string[] = [];
    adapter.onConnectionChange((state) => states.push(state));
    adapter.disconnect();
    adapter.reconnect();
    expect(states).toEqual(['disconnected', 'connected']);
  });

  it('does not deliver events while disconnected', () => {
    const adapter = new InMemoryRealtimeAdapter();
    const received: ServiceRequest[] = [];
    adapter.subscribe({ seniorIds: ['senior-1'] }, (event) => received.push(event.request));
    adapter.disconnect();
    adapter.publish({ type: 'insert', request: card({ seniorId: 'senior-1' }) });
    expect(received).toHaveLength(0);
    adapter.reconnect();
    adapter.publish({ type: 'insert', request: card({ id: 'r2', seniorId: 'senior-1' }) });
    expect(received).toHaveLength(1);
  });
});
