import { describe, expect, it } from 'vitest';
import { RequestListStore } from '@/lib/client/requestListStore';
import type { ServiceRequest } from '@/lib/domain/types';

function card(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'r1', seniorId: 'senior-1', type: 'hospital_escort', summary: 's', transcript: 't', inputType: 'voice',
    details: {}, missingFields: [], status: 'new', assigneeId: null, acknowledgedAt: null, createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
    ...overrides,
  };
}

describe('client-side request list store (id-keyed upsert, PRD §11.4/TDD §3.9)', () => {
  it('initializes from a server fetch and lists cards newest-first', () => {
    const store = new RequestListStore();
    store.hydrate([card({ id: 'r1', createdAt: '2026-08-25T00:00:00Z' }), card({ id: 'r2', createdAt: '2026-08-25T01:00:00Z' })]);
    expect(store.list().map((c) => c.id)).toEqual(['r2', 'r1']);
  });

  it('adds a new card to the top of the list on insert, marking it unread', () => {
    const store = new RequestListStore();
    store.hydrate([card({ id: 'r1' })]);
    store.upsert(card({ id: 'r2', updatedAt: '2026-08-25T01:00:00Z' }));
    expect(store.list()[0].id).toBe('r2');
    expect(store.isUnread('r2')).toBe(true);
  });

  it('does not duplicate a card when the same id event arrives twice', () => {
    const store = new RequestListStore();
    const c = card({ id: 'r1' });
    store.upsert(c);
    store.upsert(c);
    expect(store.list()).toHaveLength(1);
  });

  it('ignores an update whose updated_at is older than the currently held version', () => {
    const store = new RequestListStore();
    store.upsert(card({ id: 'r1', status: 'in_progress', updatedAt: '2026-08-25T02:00:00Z' }));
    store.upsert(card({ id: 'r1', status: 'new', updatedAt: '2026-08-25T01:00:00Z' }));
    expect(store.list()[0].status).toBe('in_progress');
  });

  it('applies a newer update over an older one', () => {
    const store = new RequestListStore();
    store.upsert(card({ id: 'r1', status: 'new', updatedAt: '2026-08-25T01:00:00Z' }));
    store.upsert(card({ id: 'r1', status: 'in_progress', updatedAt: '2026-08-25T02:00:00Z' }));
    expect(store.list()[0].status).toBe('in_progress');
  });

  it('does not clear the list on disconnect and keeps the last known cards', () => {
    const store = new RequestListStore();
    store.hydrate([card({ id: 'r1' })]);
    store.setConnectionState('disconnected');
    expect(store.list()).toHaveLength(1);
    expect(store.connectionState()).toBe('disconnected');
  });

  it('counts unread new cards for a badge and clears unread on acknowledge', () => {
    const store = new RequestListStore();
    store.upsert(card({ id: 'r1' }));
    store.upsert(card({ id: 'r2' }));
    expect(store.unreadCount()).toBe(2);
    store.acknowledge('r1');
    expect(store.unreadCount()).toBe(1);
    expect(store.isUnread('r1')).toBe(false);
  });

  it('reconciles missed events by replacing entries from a full re-fetch without dropping newer local state incorrectly', () => {
    const store = new RequestListStore();
    store.hydrate([card({ id: 'r1', status: 'new', updatedAt: '2026-08-25T01:00:00Z' })]);
    // Reconnect re-fetch brings a card updated while disconnected.
    store.hydrate([card({ id: 'r1', status: 'in_progress', updatedAt: '2026-08-25T03:00:00Z' }), card({ id: 'r2', status: 'new', updatedAt: '2026-08-25T03:00:00Z' })]);
    expect(store.list().find((c) => c.id === 'r1')?.status).toBe('in_progress');
    expect(store.list().map((c) => c.id).sort()).toEqual(['r1', 'r2']);
  });

  it('removes rows missing from an authoritative server snapshot', () => {
    const store = new RequestListStore();
    store.hydrate([card({ id: 'r1' }), card({ id: 'r2' })]);
    store.replaceSnapshot([card({ id: 'r2' })]);
    expect(store.list().map((c) => c.id)).toEqual(['r2']);
  });

  it('applies a delete tombstone and ignores a late stale update', () => {
    const store = new RequestListStore();
    store.upsert(card({ id: 'r1', updatedAt: '2026-08-25T02:00:00Z' }));
    store.remove('r1', '2026-08-25T03:00:00Z');
    store.upsert(card({ id: 'r1', updatedAt: '2026-08-25T04:00:00Z' }));
    expect(store.list()).toEqual([]);
  });
});
