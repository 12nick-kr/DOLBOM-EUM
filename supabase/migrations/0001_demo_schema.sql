-- Reference migration: execute only after the project owner explicitly approves a real Supabase migration.
-- All UI tests use the in-memory fake repository; no remote service is contacted by this repository.
create type public.app_role as enum ('senior', 'family', 'worker');
create table public.profiles (id uuid primary key, role public.app_role not null, display_name text not null, accessibility_preferences jsonb not null default '{}'::jsonb);
create table public.care_relationships (senior_id uuid not null, member_id uuid not null, relationship_type text not null, status text not null default 'active', starts_at timestamptz not null default now(), ends_at timestamptz, primary key (senior_id, member_id));
create table public.consent_grants (id uuid primary key default gen_random_uuid(), senior_id uuid not null, grantee_id uuid not null, scope text not null, purpose text not null, expires_at timestamptz, revoked_at timestamptz);
-- PRD §7.4/§13 요청 카드 정본. status는 서버 저장 가능한 4개 값만 허용한다('draft'는 클라이언트 전용이라 DB에 없다).
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.profiles(id),
  type text not null check (type in ('hospital_escort', 'welfare_info', 'daily_help')),
  summary text not null,
  transcript text not null,
  input_type text not null check (input_type in ('voice', 'text')),
  details jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}',
  status text not null check (status in ('new', 'in_progress', 'done', 'rejected')),
  assignee_id uuid references public.profiles(id),
  acknowledged_at timestamptz,
  due_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (senior_id, idempotency_key)
);
create table public.emergency_events (id uuid primary key default gen_random_uuid(), senior_id uuid not null, level text not null, utterance text, location jsonb, status text not null, created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, resource_type text not null, resource_id uuid, reason text, created_at timestamptz not null default now());
alter table public.profiles enable row level security; alter table public.care_relationships enable row level security; alter table public.consent_grants enable row level security; alter table public.service_requests enable row level security; alter table public.emergency_events enable row level security;

-- PRD §7.4/§11.4/§16: 담당 관계·동의가 있는 사람만 조회할 수 있고, 상태 전이는 담당 복지사만 서버에서 수행한다.
-- 이 정책들은 실행 전 검토용 초안이며, 실제 프로젝트에 적용하기 전 사람이 확인해야 한다.

-- 본인 조회: 노인 자신은 자신의 카드를 항상 볼 수 있다.
create policy service_requests_select_self on public.service_requests
  for select using (senior_id = auth.uid());

-- 담당 복지사 조회: care_relationships에 active 상태로 연결된 worker만 볼 수 있다.
create policy service_requests_select_assigned_worker on public.service_requests
  for select using (
    exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = service_requests.senior_id
        and cr.member_id = auth.uid()
        and cr.status = 'active'
        and cr.relationship_type = 'worker'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

-- 가족 조회: active 관계 + 만료·철회되지 않은 동의가 모두 있어야 한다. transcript는 별도 동의 항목이므로
-- 애플리케이션 레이어(redactForRole)가 응답에서 제거하며, RLS는 행 단위 접근만 강제한다.
create policy service_requests_select_family on public.service_requests
  for select using (
    exists (
      select 1 from public.care_relationships cr
      join public.consent_grants cg on cg.senior_id = cr.senior_id and cg.grantee_id = cr.member_id
      where cr.senior_id = service_requests.senior_id
        and cr.member_id = auth.uid()
        and cr.status = 'active'
        and cr.relationship_type = 'family'
        and (cr.ends_at is null or cr.ends_at > now())
        and cg.scope = 'service'
        and cg.revoked_at is null
        and (cg.expires_at is null or cg.expires_at > now())
    )
  );

-- 상태 갱신: 담당 복지사만 UPDATE할 수 있다. 허용된 상태 전이인지는 애플리케이션(policies.canTransitionRequest)이
-- 서버에서 한 번 더 검증하며, UI에서 버튼을 숨기는 것으로 대신하지 않는다.
create policy service_requests_update_assigned_worker on public.service_requests
  for update using (
    exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = service_requests.senior_id
        and cr.member_id = auth.uid()
        and cr.status = 'active'
        and cr.relationship_type = 'worker'
    )
  );

-- Active relationship + unrevoked/unexpired scoped consent must be checked in each production SELECT policy.
-- Keep authority-documents in a private bucket; object paths are generated UUIDs and never include personal names.
