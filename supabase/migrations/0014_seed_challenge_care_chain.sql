-- 챌린지 데모 계정 세 개가 같은 돌봄 그룹을 보도록 실제 auth UUID를 login_id로 찾아 연결한다.
-- 해당 계정이 아직 생성되지 않은 환경에서는 아무 것도 만들지 않으므로 반복 실행해도 안전하다.
do $$
declare
  senior_uuid uuid;
  family_uuid uuid;
  worker_uuid uuid;
  group_uuid uuid;
begin
  select id into senior_uuid from public.profiles where login_id = '01000000011' and role = 'senior' limit 1;
  select id into family_uuid from public.profiles where login_id = '01000000012' and role = 'family' limit 1;
  select id into worker_uuid from public.profiles where login_id = '01000000013' and role = 'worker' limit 1;

  if senior_uuid is null or worker_uuid is null then return; end if;

  insert into public.care_groups (senior_id, name, status, updated_at)
  values (senior_uuid, '김참치 돌봄 그룹', 'active', now())
  on conflict (senior_id) do update set status = 'active', updated_at = now()
  returning id into group_uuid;

  insert into public.care_relationships (
    senior_id, member_id, relationship_type, status, care_group_id, linked_by, starts_at, ends_at, updated_at
  ) values (
    senior_uuid, worker_uuid, 'worker', 'active', group_uuid, worker_uuid, now(), null, now()
  ) on conflict (senior_id, member_id) do update set
    relationship_type = 'worker', status = 'active', care_group_id = excluded.care_group_id,
    linked_by = excluded.linked_by, ends_at = null, updated_at = now();

  if family_uuid is not null then
    insert into public.care_relationships (
      senior_id, member_id, relationship_type, status, care_group_id, linked_by, starts_at, ends_at, updated_at
    ) values (
      senior_uuid, family_uuid, 'family', 'active', group_uuid, worker_uuid, now(), null, now()
    ) on conflict (senior_id, member_id) do update set
      relationship_type = 'family', status = 'active', care_group_id = excluded.care_group_id,
      linked_by = excluded.linked_by, ends_at = null, updated_at = now();

    insert into public.consent_grants (senior_id, grantee_id, scope, purpose, expires_at)
    select senior_uuid, family_uuid, scope_name, '챌린지 데모 돌봄 정보 공유', now() + interval '1 year'
    from unnest(array['service', 'emergency', 'health', 'location']) as scope_name
    where not exists (
      select 1 from public.consent_grants cg
      where cg.senior_id = senior_uuid and cg.grantee_id = family_uuid
        and cg.scope = scope_name and cg.revoked_at is null
    );
  end if;
end $$;

