'use client';
import { useCallback, useEffect, useState } from 'react';
import type { EmergencyEvent } from '@/lib/domain/types';

async function fetchEmergencies(): Promise<EmergencyEvent[]> {
  const response = await fetch('/api/emergencies');
  if (response.ok === false) throw new Error('긴급 알림 조회 실패');
  const body = await response.json();
  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Realtime 신호면 즉시 갱신한다. 폴링은 SSE가 끊겼을 때만 돌려, 요청 카드 쪽 폴백 정책과 맞춘다
 * (SSE가 살아 있는데도 매초 정본을 다시 읽던 낭비를 없앤다). 재연결 순간에는 한 번 조회해
 * 끊겨 있는 동안 놓친 긴급 알림을 메운다.
 */
export function useEmergencyList() {
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const load = useCallback(async () => {
    try { setEmergencies(await fetchEmergencies()); } catch { /* 마지막 정상 목록 유지 */ }
  }, []);

  useEffect(() => {
    const onEmergency = () => { void load(); };
    const onRealtimeState = (event: Event) => {
      const connected = (event as CustomEvent<string>).detail === 'connected';
      setStreaming(connected);
      if (connected) void load();
    };
    window.addEventListener('dolbom:emergency-change', onEmergency);
    window.addEventListener('dolbom:realtime-state', onRealtimeState);
    return () => {
      window.removeEventListener('dolbom:emergency-change', onEmergency);
      window.removeEventListener('dolbom:realtime-state', onRealtimeState);
    };
  }, [load]);

  useEffect(() => {
    void load();
    if (streaming) return;
    const timer = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(timer);
  }, [load, streaming]);

  const removeEmergencyOptimistically = useCallback((id: string) => {
    setEmergencies((current) => current.filter((event) => event.id !== id));
  }, []);
  const restoreEmergency = useCallback((event: EmergencyEvent) => setEmergencies((current) => current.some((item) => item.id === event.id) ? current : [event, ...current]), []);

  return { emergencies, refreshEmergencies: load, removeEmergencyOptimistically, restoreEmergency };
}
