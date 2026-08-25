-- 0001_demo_schema.sql 적용 이후 실행한다. 이 프로젝트의 데모 계정(노인/가족/복지사)에 대응하는
-- profiles 행을 만든다 — service_requests.senior_id/assignee_id가 profiles(id uuid)를 참조하는
-- 외래키이므로, 이 시드 없이는 실제 요청 카드 INSERT가 FK 위반으로 실패한다.
-- 세 UUID는 lib/server/store.ts의 demoSeniorId/demoFamilyId/demoWorkerId와 정확히 일치해야 한다.
insert into public.profiles (id, role, display_name, accessibility_preferences) values
  ('67097470-30f1-4f42-9934-1675776fd220', 'senior', '김순자', '{}'::jsonb),
  ('32765095-392f-41b9-b7d8-2598b3dc7ff6', 'family', '이지현', '{}'::jsonb),
  ('d4544569-53e6-4caa-8076-2a0d50fac39a', 'worker', '박사회복지사', '{}'::jsonb)
on conflict (id) do nothing;

-- lib/server/store.ts의 seniorIdsAssignedTo()가 가정하는 고정 1:1 배정(복지사 → 노인)을 실제
-- care_relationships 행으로도 만든다. 아직 RLS select 정책이 이 행을 근거로 auth.uid()와 비교하지만,
-- 지금은 SUPABASE_SECRET_KEY(RLS 우회)로 조회하므로 이 행이 없어도 앱은 동작한다 — 다만 실제
-- Supabase Auth 전환 시 이 행이 없으면 그 시점부터 조회가 막히므로 미리 만들어 둔다.
insert into public.care_relationships (senior_id, member_id, relationship_type, status) values
  ('67097470-30f1-4f42-9934-1675776fd220', 'd4544569-53e6-4caa-8076-2a0d50fac39a', 'worker', 'active'),
  ('67097470-30f1-4f42-9934-1675776fd220', '32765095-392f-41b9-b7d8-2598b3dc7ff6', 'family', 'active')
on conflict do nothing;

-- 가족 화면이 service_requests를 보려면 §7.4/0001의 service_requests_select_family 정책이 요구하는
-- scope='service' 동의도 있어야 한다(실제 Auth 전환 이후에 의미가 생긴다). consent_grants는 id만
-- primary key이고 (senior_id, grantee_id, scope)에는 unique 제약이 없으므로, on conflict 대신
-- 이미 존재하는지 먼저 확인하는 조건부 삽입으로 재실행해도 중복 생성되지 않게 한다.
insert into public.consent_grants (senior_id, grantee_id, scope, purpose, expires_at)
select '67097470-30f1-4f42-9934-1675776fd220', '32765095-392f-41b9-b7d8-2598b3dc7ff6', 'service', '요청 카드 상태 공유', '2027-08-25T00:00:00+09:00'
where not exists (
  select 1 from public.consent_grants
  where senior_id = '67097470-30f1-4f42-9934-1675776fd220'
    and grantee_id = '32765095-392f-41b9-b7d8-2598b3dc7ff6'
    and scope = 'service'
);
