-- 노인이 최종 확인한 음성/텍스트 입력의 append-only 정본.
-- 실제 원격 프로젝트 적용은 저장소 소유자가 별도로 수행한다.
create table public.senior_input_events (
  id uuid primary key default gen_random_uuid(),
  schema_version integer not null default 1 check (schema_version = 1),
  senior_id uuid not null references public.profiles(id),
  source text not null check (source in ('voice', 'text')),
  transcript text not null,
  category text not null check (category in ('daily', 'service_request', 'health_caution', 'emergency')),
  urgency text not null check (urgency in ('normal', 'welfare', 'caution', 'emergency')),
  summary text not null,
  visibility jsonb not null,
  service_request_id uuid references public.service_requests(id),
  emergency_event_id uuid references public.emergency_events(id),
  idempotency_key text not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (senior_id, idempotency_key)
);

alter table public.service_requests
  add column source_event_id uuid references public.senior_input_events(id);

alter table public.senior_input_events enable row level security;

create policy senior_input_events_select_self on public.senior_input_events
  for select using (senior_id = auth.uid());

create policy senior_input_events_insert_self on public.senior_input_events
  for insert with check (senior_id = auth.uid());

create policy service_requests_insert_self on public.service_requests
  for insert with check (senior_id = auth.uid() and status = 'new');

-- 가족·복지사 화면은 원본 이벤트 테이블을 직접 읽지 않는다. 관계·동의로 범위가 제한된
-- service_requests/care-cards API만 사용해 원문 노출 정책을 한 곳에서 강제한다.

create index senior_input_events_senior_created_idx
  on public.senior_input_events (senior_id, created_at desc);

create index service_requests_source_event_idx
  on public.service_requests (source_event_id);

-- postgres_changes 전달 소스에 요청 카드를 포함한다. 이미 publication에 포함된 프로젝트에서도
-- migration 재실행이 중단되지 않도록 duplicate_object만 무시한다.
do $$
begin
  alter publication supabase_realtime add table public.service_requests;
exception
  when duplicate_object then null;
end $$;
