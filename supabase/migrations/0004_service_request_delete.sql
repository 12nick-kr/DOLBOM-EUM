-- 담당 사회복지사의 요청 카드 hard delete가 연결된 노인 입력 JSON도 함께 지우도록 한다.
-- 실제 원격 프로젝트 적용은 저장소 소유자가 별도로 수행한다.
alter table public.senior_input_events
  drop constraint if exists senior_input_events_service_request_id_fkey;

alter table public.senior_input_events
  add constraint senior_input_events_service_request_id_fkey
  foreign key (service_request_id) references public.service_requests(id) on delete cascade;

alter table public.service_requests
  drop constraint if exists service_requests_source_event_id_fkey;

alter table public.service_requests
  add constraint service_requests_source_event_id_fkey
  foreign key (source_event_id) references public.senior_input_events(id) on delete set null;

create policy service_requests_delete_assigned_worker on public.service_requests
  for delete using (
    exists (
      select 1 from public.care_relationships cr
      where cr.senior_id = service_requests.senior_id
        and cr.member_id = auth.uid()
        and cr.status = 'active'
        and cr.relationship_type = 'worker'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

create or replace function public.delete_service_request_with_source(
  p_request_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_request public.service_requests%rowtype;
begin
  select * into deleted_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then return null; end if;

  insert into public.audit_logs(actor_id, action, resource_type, resource_id, reason)
  values (p_actor_id, 'service_request.deleted', 'service_request', p_request_id, '담당 사회복지사 요청 삭제');

  delete from public.service_requests where id = p_request_id;
  return to_jsonb(deleted_request);
end;
$$;

revoke all on function public.delete_service_request_with_source(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_service_request_with_source(uuid, uuid) to service_role;

-- DELETE 이벤트에서도 담당 범위를 판별할 수 있도록 old row를 포함한다.
alter table public.service_requests replica identity full;
alter table public.emergency_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.emergency_events;
exception
  when duplicate_object then null;
end $$;
