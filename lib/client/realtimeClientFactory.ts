'use client';
import type { ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientPort } from './realtimePort';
import { PollingRealtimeClient } from './pollingRealtimeClient';

/**
 * 요청 카드 실시간 클라이언트 선택 단일 결정 지점. 현재는 폴링 클라이언트만 쓴다.
 *
 * 서버가 중계하는 SSE(`/api/service-requests/stream`, `SseRealtimeClient`)를 시도했으나,
 * 실제로 붙여본 결과 Next.js 개발 서버가 라우트 핸들러별로 별도 모듈 인스턴스를 만들어
 * `lib/server/realtime.ts`의 프로세스 내부 pub/sub 싱글턴이 publish 쪽과 subscribe 쪽에서
 * 서로 다른 인스턴스로 쪼개지는 것을 실측으로 확인했다(이벤트가 전혀 전달되지 않음).
 * 이 구조는 서버리스/다중 인스턴스 배포에서도 동일하게 깨진다 — 진짜 실시간이려면 프로세스
 * 외부의 공유 소스(Postgres `postgres_changes`)에서 이벤트를 받아야 한다. 그 작업 전까지는
 * 이미 실제 Supabase 대상으로 검증된 폴링(3초 주기, `GET /api/service-requests` 재조회)을
 * 그대로 쓴다 — PRD §11.4 "실시간은 최적화이고 정본은 항상 서버 조회다"를 그대로 만족한다.
 */
export function createRealtimeClient(fetchList: () => Promise<ServiceRequest[]>): RealtimeClientPort {
  return new PollingRealtimeClient(fetchList);
}
