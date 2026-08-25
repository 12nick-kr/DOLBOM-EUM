'use client';
import type { ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientEvent, RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

/**
 * SSE(`/api/care-events`)가 끊겼을 때 쓰는 폴백 어댑터.
 * 짧은 주기로 목록을 다시 조회해 이전 스냅샷과 비교하고, 새 카드/갱신된 카드를 insert/update
 * 이벤트로 변환해 내보낸다. 컴포넌트/훅은 `RealtimeClientPort`에만 의존하므로, 어느 쪽이
 * 실제로 이벤트를 만들어 내든 `useServiceRequestList`는 변경할 필요가 없다.
 */
export class PollingRealtimeClient implements RealtimeClientPort {
  private listeners = new Set<(event: RealtimeClientEvent) => void>();
  private connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  // 첫 조회가 성공하기 전까지는 연결됨을 주장하지 않는다 — 서버가 죽어 있어도
  // 최초 한 주기 동안 "연결됨" 배지가 뜨던 원인이었다.
  private state: RealtimeConnectionState = 'disconnected';
  private known = new Map<string, string>(); // id -> updatedAt
  private timer: ReturnType<typeof setInterval> | null = null;
  private immediateTimer: ReturnType<typeof setTimeout> | null = null;
  private active = true;

  constructor(private fetchList: () => Promise<ServiceRequest[]>, private intervalMs = 5000) {
    this.start();
  }

  private start() {
    if (!this.active || this.timer) return;
    this.immediateTimer = setTimeout(() => { void this.tick(); }, 0);
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
  }

  private async tick() {
    try {
      const rows = await this.fetchList();
      this.setConnectionState('connected');
      const seen = new Set(rows.map((row) => row.id));
      for (const row of rows) {
        const knownUpdatedAt = this.known.get(row.id);
        if (!knownUpdatedAt) {
          this.known.set(row.id, row.updatedAt);
          this.emit({ type: 'insert', request: row });
        } else if (knownUpdatedAt < row.updatedAt) {
          this.known.set(row.id, row.updatedAt);
          this.emit({ type: 'update', request: row });
        }
      }
      for (const id of [...this.known.keys()]) {
        if (seen.has(id)) continue;
        this.known.delete(id);
        this.emit({ type: 'delete', id, deletedAt: new Date().toISOString() });
      }
    } catch {
      this.setConnectionState('disconnected');
    }
  }

  private emit(event: RealtimeClientEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private setConnectionState(state: RealtimeConnectionState) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.connectionListeners) listener(state);
  }

  subscribe(listener: (event: RealtimeClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onConnectionChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  connectionState(): RealtimeConnectionState {
    return this.state;
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      if (this.timer) clearInterval(this.timer);
      if (this.immediateTimer) clearTimeout(this.immediateTimer);
      this.timer = null;
      this.immediateTimer = null;
      return;
    }
    this.start();
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.immediateTimer) clearTimeout(this.immediateTimer);
    this.timer = null;
    this.immediateTimer = null;
  }
}
