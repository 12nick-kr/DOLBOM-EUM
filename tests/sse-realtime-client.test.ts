import { afterEach, describe, expect, it, vi } from 'vitest';
import { SseRealtimeClient } from '@/lib/client/sseRealtimeClient';
import type { ServiceRequest } from '@/lib/domain/types';

const card: ServiceRequest = {
  id: 'request-sse-1', seniorId: 'senior-1', type: 'hospital_escort', summary: '병원 동행', transcript: '원문', inputType: 'text',
  details: {}, missingFields: [], status: 'new', assigneeId: null, acknowledgedAt: null,
  createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
};

class FakeEventSource {
  static latest: FakeEventSource;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { FakeEventSource.latest = this; }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); }
}

describe('SseRealtimeClient — safe server-push adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits redacted service events and delete tombstones from the server stream', () => {
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    const client = SseRealtimeClient.create();
    expect(client).not.toBeNull();
    const received: string[] = [];
    const states: string[] = [];
    client!.subscribe((event) => received.push(event.type === 'delete' ? `delete:${event.id}` : `${event.type}:${event.request.id}`));
    client!.onConnectionChange((state) => states.push(state));

    FakeEventSource.latest.message({ resource: 'ready' });
    FakeEventSource.latest.message({ resource: 'service_request', type: 'insert', request: card });
    FakeEventSource.latest.message({ resource: 'service_request', type: 'delete', id: card.id, deletedAt: '2026-08-25T01:00:00Z' });

    expect(states).toEqual(['connected']);
    expect(received).toEqual([`insert:${card.id}`, `delete:${card.id}`]);
    client!.dispose();
    expect(FakeEventSource.latest.close).toHaveBeenCalled();
  });
});
