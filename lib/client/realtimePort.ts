import type { ServiceRequest } from '@/lib/domain/types';

export type RealtimeClientEvent =
  | { type: 'insert' | 'update'; request: ServiceRequest }
  | { type: 'delete'; id: string; deletedAt: string; seniorId?: string };
export type RealtimeConnectionState = 'connected' | 'disconnected';

/**
 * 클라이언트가 의존하는 realtime 포트. 컴포넌트/훅은 이 인터페이스에만 의존하고, 실제 구현
 * (Supabase Realtime 채널 어댑터 또는 테스트용 in-memory fake)은 주입받는다 — PRD §11.4/TDD §3.9:
 * "단위·컴포넌트 테스트가 실제 Supabase Realtime 연결에 의존하지 않아야 한다."
 */
export interface RealtimeClientPort {
  subscribe(listener: (event: RealtimeClientEvent) => void): () => void;
  onConnectionChange(listener: (state: RealtimeConnectionState) => void): () => void;
  connectionState(): RealtimeConnectionState;
  /** primary push가 연결된 동안 fallback 폴링을 멈추기 위한 선택적 수명주기 제어. */
  setActive?(active: boolean): void;
  /** 하위 리소스(polling interval 등)를 정리한다. 컴포넌트 unmount 시 반드시 호출한다. */
  dispose(): void;
}

/** 테스트와 데모에서 쓰는 in-memory fake — 서버를 거치지 않고 즉시 이벤트를 전달한다. */
export class FakeRealtimeClient implements RealtimeClientPort {
  private listeners = new Set<(event: RealtimeClientEvent) => void>();
  private connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  private state: RealtimeConnectionState = 'connected';

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

  /** 테스트 헬퍼: 서버에서 이벤트가 도착한 것처럼 시뮬레이션한다. */
  emit(event: RealtimeClientEvent): void {
    if (this.state === 'disconnected') return;
    for (const listener of this.listeners) listener(event);
  }

  setConnectionState(state: RealtimeConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.connectionListeners) listener(state);
  }

  dispose(): void {
    this.listeners.clear();
    this.connectionListeners.clear();
  }
}
