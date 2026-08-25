'use client';
import type { ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientEvent, RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

/**
 * 실제 Supabase Realtime 채널이 붙기 전까지 쓰는 브라우저 런타임 어댑터.
 * 짧은 주기로 목록을 다시 조회해 이전 스냅샷과 비교하고, 새 카드/갱신된 카드를 insert/update
 * 이벤트로 변환해 내보낸다. 컴포넌트/훅은 `RealtimeClientPort`에만 의존하므로, 이 구현을
 * Supabase Realtime 어댑터로 교체해도 `useServiceRequestList`는 변경할 필요가 없다.
 */
export class PollingRealtimeClient implements RealtimeClientPort {
  private listeners = new Set<(event: RealtimeClientEvent) => void>();
  private connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  private state: RealtimeConnectionState = 'connected';
  private known = new Map<string, string>(); // id -> updatedAt
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private fetchList: () => Promise<ServiceRequest[]>, private intervalMs = 3000) {
    this.timer = setInterval(() => { this.tick(); }, this.intervalMs);
  }

  private async tick() {
    try {
      const rows = await this.fetchList();
      if (this.state === 'disconnected') this.setConnectionState('connected');
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

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
