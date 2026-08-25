'use client';
import type { ServiceRequestView as ServiceRequest } from '@/lib/domain/types';
import type { RealtimeClientPort } from './realtimePort';
import { PollingRealtimeClient } from './pollingRealtimeClient';
import { ResilientRealtimeClient } from './resilientRealtimeClient';
import { SseRealtimeClient } from './sseRealtimeClient';

/** 요청 카드 실시간 선택 지점. Supabase를 외부 브로커로 쓰는 서버 SSE를 우선하고 5초 폴링을 장애 폴백으로 둔다. */
export function createRealtimeClient(fetchList: () => Promise<ServiceRequest[]>): RealtimeClientPort {
  const fallback = new PollingRealtimeClient(fetchList);
  const primary = SseRealtimeClient.create();
  return new ResilientRealtimeClient(primary, fallback);
}
