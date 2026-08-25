-- 담당 사회복지사의 긴급 알림 해제는 긴급 이벤트와 연결 입력 JSON을 원자적으로 삭제한다.
alter table public.senior_input_events
  drop constraint if exists senior_input_events_emergency_event_id_fkey;

alter table public.senior_input_events
  add constraint senior_input_events_emergency_event_id_fkey
  foreign key (emergency_event_id) references public.emergency_events(id) on delete cascade;

drop policy if exists emergency_events_delete_assigned_worker on public.emergency_events;
create policy emergency_events_delete_assigned_worker on public.emergency_events
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.care_relationships cr on cr.member_id = p.id
      where p.id = (select auth.uid())
        and p.role = 'worker'
        and p.account_status = 'active'
        and cr.senior_id = emergency_events.senior_id
        and cr.relationship_type = 'worker'
        and cr.status = 'active'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

create or replace function public.delete_emergency_event_with_source(
  p_event_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_event public.emergency_events%rowtype;
begin
  select * into deleted_event
  from public.emergency_events
  where id = p_event_id
  for update;

  if not found then return null; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.care_relationships cr on cr.member_id = p.id
    where p.id = p_actor_id
      and p.role = 'worker'
      and p.account_status = 'active'
      and cr.senior_id = deleted_event.senior_id
      and cr.relationship_type = 'worker'
      and cr.status = 'active'
      and (cr.ends_at is null or cr.ends_at > now())
  ) then
    raise exception 'assigned worker required' using errcode = '42501';
  end if;

  -- 원문·위치는 감사 로그에 복사하지 않고 식별자와 행위 이유만 보존한다.
  insert into public.audit_logs(actor_id, action, resource_type, resource_id, reason)
  values (p_actor_id, 'emergency_event.deleted', 'emergency_event', p_event_id, '담당 사회복지사 긴급 알림 해제 및 삭제');

  delete from public.emergency_events where id = p_event_id;
  return to_jsonb(deleted_event);
end;
$$;

revoke all on function public.delete_emergency_event_with_source(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_emergency_event_with_source(uuid, uuid) to service_role;

alter table public.emergency_events replica identity full;
