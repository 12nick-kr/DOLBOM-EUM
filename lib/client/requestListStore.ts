import type { ServiceRequest } from '@/lib/domain/types';
import type { ConnectionState } from '@/lib/server/realtime';

/**
 * 클라이언트 카드 목록 저장소 — `id` 기준 map으로 관리하고 이벤트를 upsert로 처리한다 (PRD §11.4/TDD §3.9).
 * - 초기 조회(`hydrate`)가 실시간 구독보다 먼저 상태를 만든다.
 * - 중복 이벤트가 목록을 늘리지 않고, `updatedAt`이 더 오래된 이벤트는 무시한다.
 * - 연결이 끊겨도 마지막으로 받은 목록을 유지한다(절대 비우지 않는다).
 */
export class RequestListStore {
  private rows = new Map<string, ServiceRequest>();
  private unread = new Set<string>();
  private connection: ConnectionState = 'connected';

  /** 서버 재조회 결과로 목록을 갱신한다. 화면 진입 시 최초 1회, 재연결 시 누락분을 메우는 데 쓴다. */
  hydrate(requests: ServiceRequest[]): void {
    for (const request of requests) {
      const existing = this.rows.get(request.id);
      if (!existing || existing.updatedAt <= request.updatedAt) this.rows.set(request.id, request);
    }
  }

  /** 실시간 insert/update 이벤트를 반영한다. id 기준 upsert이며 오래된 updatedAt은 무시한다. */
  upsert(request: ServiceRequest): void {
    const existing = this.rows.get(request.id);
    const isNew = !existing;
    if (existing && existing.updatedAt >= request.updatedAt) return;
    this.rows.set(request.id, request);
    if (isNew) this.unread.add(request.id);
  }

  list(): ServiceRequest[] {
    return [...this.rows.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  isUnread(id: string): boolean {
    return this.unread.has(id);
  }

  unreadCount(): number {
    return this.unread.size;
  }

  acknowledge(id: string): void {
    this.unread.delete(id);
  }

  setConnectionState(state: ConnectionState): void {
    this.connection = state;
  }

  connectionState(): ConnectionState {
    return this.connection;
  }
}
