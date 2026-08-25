import { createClient } from '@supabase/supabase-js';
import { InMemoryServiceRequestRepository, type ServiceRequestRepository } from './serviceRequestRepository';
import { SupabaseServiceRequestRepository } from './supabaseServiceRequestRepository';
import type { ServiceRequest } from '@/lib/domain/types';

export type ServiceRequestRepositorySelection = { repository: ServiceRequestRepository; provider: 'supabase' | 'in-memory' };

/**
 * `ServiceRequestRepository` 선택 단일 결정 지점 (PRD §11.5). Supabase 세 환경변수가 모두 있을
 * 때만 Postgres 어댑터를 쓰고, 하나라도 없으면 in-memory fake로 폴백한다 — 부분 설정으로
 * "반쯤 연결된" 상태를 만들지 않는다. `SUPABASE_SECRET_KEY`(RLS 우회, 서버 전용)를 쓰는 이유는
 * 이 저장소가 API route에서 이미 `demoActor`로 권한을 검증한 뒤 호출되기 때문이며, 실제 Supabase
 * Auth 연동 전까지는 임시로 서버가 권한 재검증을 대신한다. Auth가 붙으면 사용자 JWT + RLS로
 * 전환해야 한다(PRD §11.5 "일반 요청은 사용자 JWT + RLS로 처리").
 */
export function selectServiceRequestRepository(env: Record<string, string | undefined> = process.env, seed: ServiceRequest[] = []): ServiceRequestRepositorySelection {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  const hasCredentials = Boolean(url) && Boolean(key);
  if (!hasCredentials) {
    return { repository: new InMemoryServiceRequestRepository(seed), provider: 'in-memory' };
  }
  const client = createClient(url as string, key as string);
  return { repository: new SupabaseServiceRequestRepository(client), provider: 'supabase' };
}
