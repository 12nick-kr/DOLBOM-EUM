'use client';
import { useCallback, useEffect, useState } from 'react';
import type { EmergencyEvent } from '@/lib/domain/types';

async function fetchEmergencies(): Promise<EmergencyEvent[]> {
  const response = await fetch('/api/emergencies');
  if (response.ok === false) throw new Error('긴급 알림 조회 실패');
  const body = await response.json();
  return Array.isArray(body.data) ? body.data : [];
}

/** Realtime 신호면 즉시 갱신하고, 긴급 publication 누락에도 멈추지 않도록 5초 정본 조회를 유지한다. */
export function useEmergencyList() {
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const load = useCallback(async () => {
    try { setEmergencies(await fetchEmergencies()); } catch { /* 마지막 정상 목록 유지 */ }
  }, []);

  useEffect(() => {
    const onEmergency = () => { void load(); };
    window.addEventListener('dolbom:emergency-change', onEmergency);
    return () => {
      window.removeEventListener('dolbom:emergency-change', onEmergency);
    };
  }, [load]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const removeEmergencyOptimistically = useCallback((id: string) => {
    setEmergencies((current) => current.filter((event) => event.id !== id));
  }, []);
  const restoreEmergency = useCallback((event: EmergencyEvent) => setEmergencies((current) => current.some((item) => item.id === event.id) ? current : [event, ...current]), []);

  return { emergencies, refreshEmergencies: load, removeEmergencyOptimistically, restoreEmergency };
}
