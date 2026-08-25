import type { ServiceRequest } from '@/lib/domain/types';

export type RealtimeEvent = { type: 'insert' | 'update'; request: ServiceRequest };
export type ConnectionState = 'connected' | 'disconnected';

/** 구독 범위 — 담당 관계에 속한 senior 집합만 받는다 (PRD §11.4: 전체 테이블 구독 금지). */
export type RealtimeScope = { seniorIds: string[] };

/**
 * 요청 카드 실시간 포트. PRD §11.4/TDD §3.9: 실시간은 UI 갱신 최적화이며 데이터 정본은
 * 항상 서버 조회다. 실제 구현(Supabase Realtime `postgres_changes` + 사용자 JWT)이 붙기 전까지
 * 이 인터페이스 뒤의 in-memory fake로 모든 테스트/컴포넌트가 동작한다.
 */
export interface RealtimePort {
  subscribe(scope: RealtimeScope, listener: (event: RealtimeEvent) => void): () => void;
  publish(event: RealtimeEvent): void;
  onConnectionChange(listener: (state: ConnectionState) => void): () => void;
  disconnect(): void;
  reconnect(): void;
  connectionState(): ConnectionState;
}

type Subscription = { scope: RealtimeScope; listener: (event: RealtimeEvent) => void };

export class InMemoryRealtimeAdapter implements RealtimePort {
  private subscriptions = new Set<Subscription>();
  private connectionListeners = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'connected';

  subscribe(scope: RealtimeScope, listener: (event: RealtimeEvent) => void): () => void {
    const sub: Subscription = { scope, listener };
    this.subscriptions.add(sub);
    return () => this.subscriptions.delete(sub);
  }

  publish(event: RealtimeEvent): void {
    if (this.state === 'disconnected') return;
    for (const sub of this.subscriptions) {
      if (sub.scope.seniorIds.includes(event.request.seniorId)) sub.listener(event);
    }
  }

  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.connectionListeners) listener(next);
  }

  disconnect(): void { this.setState('disconnected'); }
  reconnect(): void { this.setState('connected'); }
  connectionState(): ConnectionState { return this.state; }
}

/** 프로세스 전역 싱글턴 — API route(서버)와 (데모 목적의) 클라이언트 폴링/구독 모두 같은 인스턴스를 공유한다. */
export const realtime: RealtimePort = new InMemoryRealtimeAdapter();
