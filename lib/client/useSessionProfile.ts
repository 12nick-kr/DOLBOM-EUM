'use client';
import { useEffect, useState } from 'react';
import type { Role } from '@/lib/domain/types';

export type SessionProfile = { id: string; role: Role; displayName: string };

/**
 * 로그인한 본인 정보. 화면 인사말이 하드코딩된 데모 이름을 쓰지 않도록 서버 세션에서 가져온다.
 * 조회 전/실패 시에는 이름을 지어내지 않고 null을 유지하며, 호출부가 중립 문구로 대체한다.
 */
export function useSessionProfile(): SessionProfile | null {
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/session');
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled && body?.data) setProfile(body.data as SessionProfile);
      } catch { /* 인사말은 부가 정보다 — 실패해도 화면 동작을 막지 않는다. */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return profile;
}
