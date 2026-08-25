-- 전화번호 데모 계정의 최종 역할 경계. API도 같은 검사를 수행하며 RLS는 우회 접근을 막는 2차 방어선이다.
alter table public.profiles enable row level security;
alter table public.care_groups enable row level security;
alter table public.care_relationships enable row level security;
alter table public.consent_grants enable row level security;
alter table public.senior_input_events enable row level security;
alter table public.service_requests enable row level security;
alter table public.emergency_events enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists consent_grants_select_participant on public.consent_grants;
create policy consent_grants_select_participant on public.consent_grants
  for select to authenticated
  using (senior_id = (select auth.uid()) or grantee_id = (select auth.uid()));

drop policy if exists consent_grants_insert_self on public.consent_grants;
create policy consent_grants_insert_self on public.consent_grants
  for insert to authenticated
  with check (
    senior_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'senior' and p.account_status = 'active'
    )
    and exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = consent_grants.senior_id
        and cr.member_id = consent_grants.grantee_id
        and cr.relationship_type = 'family'
        and cr.status = 'active'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

drop policy if exists consent_grants_update_self on public.consent_grants;
create policy consent_grants_update_self on public.consent_grants
  for update to authenticated
  using (senior_id = (select auth.uid()))
  with check (senior_id = (select auth.uid()));

drop policy if exists service_requests_select_self on public.service_requests;
drop policy if exists service_requests_select_assigned_worker on public.service_requests;
drop policy if exists service_requests_select_family on public.service_requests;
create policy service_requests_select_visible on public.service_requests
  for select to authenticated
  using (
    senior_id = (select auth.uid())
    or exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = service_requests.senior_id
        and cr.member_id = (select auth.uid())
        and cr.status = 'active'
        and cr.relationship_type in ('family', 'worker')
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

drop policy if exists service_requests_insert_self on public.service_requests;
create policy service_requests_insert_self on public.service_requests
  for insert to authenticated
  with check (
    senior_id = (select auth.uid())
    and status = 'new'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'senior' and p.account_status = 'active'
    )
  );

drop policy if exists service_requests_update_assigned_worker on public.service_requests;
create policy service_requests_update_assigned_worker on public.service_requests
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.care_relationships cr on cr.member_id = p.id
      where p.id = (select auth.uid()) and p.role = 'worker' and p.account_status = 'active'
        and cr.senior_id = service_requests.senior_id
        and cr.relationship_type = 'worker' and cr.status = 'active'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

drop policy if exists emergency_events_select_visible on public.emergency_events;
create policy emergency_events_select_visible on public.emergency_events
  for select to authenticated
  using (
    senior_id = (select auth.uid())
    or exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = emergency_events.senior_id
        and cr.member_id = (select auth.uid())
        and cr.status = 'active'
        and cr.relationship_type in ('family', 'worker')
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

drop policy if exists emergency_events_insert_self on public.emergency_events;
create policy emergency_events_insert_self on public.emergency_events
  for insert to authenticated
  with check (
    senior_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'senior' and p.account_status = 'active'
    )
  );

drop policy if exists emergency_events_update_owner_or_worker on public.emergency_events;
create policy emergency_events_update_owner_or_worker on public.emergency_events
  for update to authenticated
  using (
    senior_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      join public.care_relationships cr on cr.member_id = p.id
      where p.id = (select auth.uid()) and p.role = 'worker' and p.account_status = 'active'
        and cr.senior_id = emergency_events.senior_id
        and cr.relationship_type = 'worker' and cr.status = 'active'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

-- 서비스 역할만 감사 로그를 기록하고 읽는다. 원문과 위치는 감사 로그에 복제하지 않는다.
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.senior_input_events from anon;
revoke all on table public.service_requests from anon;
revoke all on table public.emergency_events from anon;
revoke all on table public.consent_grants from anon;
grant select, insert on table public.senior_input_events to authenticated;
grant select, insert, update, delete on table public.service_requests to authenticated;
grant select, insert, update, delete on table public.emergency_events to authenticated;
grant select, insert, update on table public.consent_grants to authenticated;

-- 요청 삭제 RPC도 전달받은 actor id만 믿지 않고 담당 사회복지사 관계를 다시 검증한다.
create or replace function public.delete_service_request_with_source(
  p_request_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_request public.service_requests%rowtype;
begin
  select * into deleted_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then return null; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.care_relationships cr on cr.member_id = p.id
    where p.id = p_actor_id
      and p.role = 'worker'
      and p.account_status = 'active'
      and cr.senior_id = deleted_request.senior_id
      and cr.relationship_type = 'worker'
      and cr.status = 'active'
      and (cr.ends_at is null or cr.ends_at > now())
  ) then
    raise exception 'assigned worker required' using errcode = '42501';
  end if;

  insert into public.audit_logs(actor_id, action, resource_type, resource_id, reason)
  values (p_actor_id, 'service_request.deleted', 'service_request', p_request_id, '담당 사회복지사 요청 삭제');

  delete from public.service_requests where id = p_request_id;
  return to_jsonb(deleted_request);
end;
$$;

revoke all on function public.delete_service_request_with_source(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_service_request_with_source(uuid, uuid) to service_role;
