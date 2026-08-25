-- 업무 상태와 희망 일정 상태를 분리하고 완료 행위자를 서버 정본으로 남긴다.
alter table public.service_requests
  add column if not exists service_date date,
  add column if not exists schedule_timezone text not null default 'Asia/Seoul',
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid;

update public.service_requests
set service_date = coalesce(
  case when nullif(details->>'desiredDateStart', '') ~ '^\d{4}-\d{2}-\d{2}$' then (details->>'desiredDateStart')::date else null end,
  case
    when nullif(details->>'desiredAt', '') ~ '^\d{4}-\d{2}-\d{2}' then left(details->>'desiredAt', 10)::date
    when due_at is not null then (due_at at time zone 'Asia/Seoul')::date
    else null
  end
)
where service_date is null;

-- 기존 완료 데이터는 마이그레이션 시점의 정본 값으로 보완한다.
update public.service_requests
set completed_at = coalesce(completed_at, updated_at),
    completed_by = coalesce(completed_by, assignee_id)
where status = 'done';

do $$
begin
  alter table public.service_requests
    add constraint service_requests_completed_by_fkey
    foreign key (completed_by) references public.profiles(id) on delete set null not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_schedule_timezone_check
    check (schedule_timezone = 'Asia/Seoul') not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_done_metadata_check
    check (status <> 'done' or completed_at is not null) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists service_requests_schedule_queue_idx
  on public.service_requests (status, service_date, created_at desc);

create index if not exists service_requests_completed_idx
  on public.service_requests (completed_at desc)
  where status = 'done';
