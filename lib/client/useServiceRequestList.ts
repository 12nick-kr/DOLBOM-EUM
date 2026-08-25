'use client';
import { useEffect, useRef, useState } from 'react';
import type { ServiceRequest } from '@/lib/domain/types';
import { RequestListStore } from './requestListStore';
import type { RealtimeClientPort, RealtimeConnectionState } from './realtimePort';

export type UseServiceRequestListOptions = {
  /** null이면 realtime을 완전히 끈 상태 — 목록은 fetchList 결과만으로 채워진다(FR-08: 실시간이 꺼져도 새로고침이면 같은 카드가 보인다). */
  realtime: RealtimeClientPort | null;
  fetchList: () => Promise<ServiceRequest[]>;
};

export type UseServiceRequestListResult = {
  requests: ServiceRequest[];
  connectionState: RealtimeConnectionState;
  unreadCount: number;
  isUnread: (id: string) => boolean;
  acknowledge: (id: string) => void;
  refetch: () => Promise<void>;
  isLoading: boolean;
  removeOptimistically: (id: string) => ServiceRequest | undefined;
  restore: (request: ServiceRequest) => void;
  upsertOptimistically: (request: ServiceRequest) => void;
};

/**
 * 화면 진입 시 한 번 목록을 조회해 초기 상태를 만들고, 그 뒤 구독을 연다 (PRD §11.4).
 * 재연결 시 서버 재조회로 누락 구간을 메운다. realtime이 null이면 순수 fetch 목록으로만 동작한다.
 */
export function useServiceRequestList({ realtime, fetchList }: UseServiceRequestListOptions): UseServiceRequestListResult {
  const storeRef = useRef<RequestListStore>(undefined as unknown as RequestListStore);
  if (!storeRef.current) storeRef.current = new RequestListStore();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('connected');
  const [isLoading, setIsLoading] = useState(true);
  const [, forceRender] = useState(0);

  const sync = () => { setRequests(storeRef.current.list()); forceRender((n) => n + 1); };

  const refetch = async () => {
    const requestedAt = new Date().toISOString();
    try {
      const fresh = await fetchList();
      storeRef.current.replaceSnapshot(fresh, requestedAt);
      sync();
    } catch {
      // 네트워크/서버 장애가 있어도 화면은 마지막으로 받은 목록을 유지한다(FR-08, §7.1 긴급 버튼은
      // AI/네트워크 장애와 무관하게 동작해야 하며, 이 목록 조회 실패가 다른 화면을 막지 않아야 한다).
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const requestedAt = new Date().toISOString();
      try {
        const fresh = await fetchList();
        if (cancelled) return;
        storeRef.current.replaceSnapshot(fresh, requestedAt);
        sync();
      } catch {
        // 초기 조회가 실패해도 컴포넌트는 정상 렌더링을 계속한다 — 빈 목록으로 시작할 뿐이다.
      } finally { if (!cancelled) setIsLoading(false); }
    })();

    if (!realtime) return () => { cancelled = true; };

    const unsubscribeEvents = realtime.subscribe((event) => {
      if (event.type === 'delete') storeRef.current.remove(event.id, event.deletedAt);
      else storeRef.current.upsert(event.request);
      sync();
    });
    const unsubscribeConnection = realtime.onConnectionChange((state) => {
      storeRef.current.setConnectionState(state);
      setConnectionState(state);
      if (state === 'connected') {
        // 재연결 시 누락 구간을 서버 재조회로 메운다.
        const requestedAt = new Date().toISOString();
        fetchList().then((fresh) => { if (!cancelled) { storeRef.current.replaceSnapshot(fresh, requestedAt); sync(); } }).catch(() => {});
      }
    });

    return () => { cancelled = true; unsubscribeEvents(); unsubscribeConnection(); };
    // fetchList는 안정적인 콜백으로 전달되는 것을 전제로 realtime 변경에만 반응한다.
  }, [realtime]);

  return {
    requests,
    connectionState,
    unreadCount: storeRef.current.unreadCount(),
    isUnread: (id: string) => storeRef.current.isUnread(id),
    acknowledge: (id: string) => { storeRef.current.acknowledge(id); sync(); },
    refetch,
    isLoading,
    removeOptimistically: (id: string) => { const removed = storeRef.current.remove(id); sync(); return removed; },
    restore: (request: ServiceRequest) => { storeRef.current.restore(request); sync(); },
    upsertOptimistically: (request: ServiceRequest) => { storeRef.current.upsert(request); sync(); },
  };
}
