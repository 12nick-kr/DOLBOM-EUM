import type { ServiceRequestView as ServiceRequest } from '@/lib/domain/types';
import type { ConnectionState } from '@/lib/server/realtime';

/**
 * tombstone 보관 기간. 삭제 직전에 출발한 조회 응답이 뒤늦게 도착해 카드를 되살리는 것만 막으면 되므로,
 * 실시간 이벤트/정본 조회 지연 허용치보다 넉넉한 60초면 충분하다. 이 기간이 지나면 정리해
 * 오래 열어 둔 화면에서 tombstone Map이 무한히 커지지 않게 한다.
 */
const TOMBSTONE_TTL_MS = 60_000;

/**
 * 클라이언트 카드 목록 저장소 — `id` 기준 map으로 관리하고 이벤트를 upsert로 처리한다 (PRD §11.4/TDD §3.9).
 * - 초기 조회(`replaceSnapshot`)가 실시간 구독보다 먼저 상태를 만든다.
 * - 중복 이벤트가 목록을 늘리지 않고, `updatedAt`이 더 오래된 이벤트는 무시한다.
 * - 연결이 끊겨도 마지막으로 받은 목록을 유지한다(절대 비우지 않는다).
 */
export class RequestListStore {
  private rows = new Map<string, ServiceRequest>();
  private unread = new Set<string>();
  private tombstones = new Map<string, string>();
  private connection: ConnectionState = 'connected';

  /** 전체 서버 조회는 정본 스냅샷이다. 누락된 행을 제거하되 조회 도중 도착한 최신 이벤트는 보존한다. */
  replaceSnapshot(requests: ServiceRequest[], requestedAt = new Date().toISOString()): void {
    this.expireTombstones(requestedAt);
    const next = new Map<string, ServiceRequest>();
    for (const request of requests) {
      const tombstone = this.tombstones.get(request.id);
      if (tombstone && requestedAt <= tombstone) continue;
      if (tombstone) this.tombstones.delete(request.id);
      const existing = this.rows.get(request.id);
      next.set(request.id, existing && existing.updatedAt > request.updatedAt ? existing : request);
    }
    for (const [id, existing] of this.rows) {
      if (!next.has(id) && existing.updatedAt > requestedAt && !this.tombstones.has(id)) next.set(id, existing);
    }
    this.rows = next;
    for (const id of this.unread) if (!this.rows.has(id)) this.unread.delete(id);
  }

  /** TTL이 지난 tombstone을 버린다. 그 시점엔 서버 정본이 이미 삭제를 반영했으므로 부활 위험이 없다. */
  private expireTombstones(now: string): void {
    const cutoff = Date.parse(now) - TOMBSTONE_TTL_MS;
    if (Number.isNaN(cutoff)) return;
    for (const [id, deletedAt] of this.tombstones) {
      if (Date.parse(deletedAt) < cutoff) this.tombstones.delete(id);
    }
  }

  /** 실시간 insert/update 이벤트를 반영한다. id 기준 upsert이며 오래된 updatedAt은 무시한다. */
  upsert(request: ServiceRequest): void {
    const tombstone = this.tombstones.get(request.id);
    if (tombstone) return;
    const existing = this.rows.get(request.id);
    const isNew = !existing;
    if (existing && existing.updatedAt >= request.updatedAt) return;
    this.rows.set(request.id, request);
    if (isNew) this.unread.add(request.id);
  }

  remove(id: string, deletedAt = new Date().toISOString()): ServiceRequest | undefined {
    const existing = this.rows.get(id);
    const previousTombstone = this.tombstones.get(id);
    if (previousTombstone && previousTombstone >= deletedAt) return existing;
    this.rows.delete(id);
    this.unread.delete(id);
    this.tombstones.set(id, deletedAt);
    return existing;
  }

  restore(request: ServiceRequest): void {
    this.tombstones.delete(request.id);
    this.rows.set(request.id, request);
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

  /** 삭제 표식 보유 수 — TTL 정리가 실제로 동작하는지 검증하기 위한 관찰 지점. */
  tombstoneCount(): number {
    return this.tombstones.size;
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
