'use client';
import type { RealtimeClientEvent, RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

/** Supabase push와 폴링을 함께 사용한다. id/updatedAt 중복 제거는 상위 RequestListStore가 담당한다. */
export class ResilientRealtimeClient implements RealtimeClientPort {
  private eventListeners = new Set<(event: RealtimeClientEvent) => void>();
  private stateListeners = new Set<(state: RealtimeConnectionState) => void>();
  private unsubs: Array<() => void> = [];

  constructor(private primary: RealtimeClientPort | null, private fallback: RealtimeClientPort) {
    for (const port of [primary, fallback].filter(Boolean) as RealtimeClientPort[]) {
      this.unsubs.push(port.subscribe((event) => this.eventListeners.forEach((listener) => listener(event))));
      this.unsubs.push(port.onConnectionChange(() => {
        if (port === this.primary) this.fallback.setActive?.(this.primary?.connectionState() !== 'connected');
        this.emitState();
      }));
    }
    this.fallback.setActive?.(this.primary?.connectionState() !== 'connected');
  }

  private emitState() { const state = this.connectionState(); for (const listener of this.stateListeners) listener(state); }
  subscribe(listener: (event: RealtimeClientEvent) => void): () => void { this.eventListeners.add(listener); return () => this.eventListeners.delete(listener); }
  onConnectionChange(listener: (state: RealtimeConnectionState) => void): () => void { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener); }
  connectionState(): RealtimeConnectionState {
    return this.primary?.connectionState() === 'connected' || this.fallback.connectionState() === 'connected' ? 'connected' : 'disconnected';
  }
  dispose(): void {
    this.unsubs.forEach((unsubscribe) => unsubscribe());
    this.primary?.dispose();
    this.fallback.dispose();
    this.eventListeners.clear();
    this.stateListeners.clear();
  }
}
