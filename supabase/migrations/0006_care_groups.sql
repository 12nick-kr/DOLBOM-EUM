-- 노인 한 명을 중심으로 가족과 담당 사회복지사를 하나의 돌봄 그룹으로 묶는다.
create table if not exists public.care_groups (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.profiles(id),
  name text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (senior_id)
);

alter table public.care_relationships
  add column if not exists care_group_id uuid,
  add column if not exists linked_by uuid,
  add column if not exists updated_at timestamptz not null default now();

insert into public.care_groups (senior_id, name)
select distinct cr.senior_id, p.display_name || ' 돌봄 그룹'
from public.care_relationships cr
join public.profiles p on p.id = cr.senior_id
on conflict (senior_id) do nothing;

update public.care_relationships cr
set care_group_id = cg.id,
    linked_by = coalesce(cr.linked_by, case when cr.relationship_type = 'worker' then cr.member_id else null end)
from public.care_groups cg
where cg.senior_id = cr.senior_id
  and cr.care_group_id is null;

do $$
begin
  alter table public.care_relationships
    add constraint care_relationships_group_id_fkey
    foreign key (care_group_id) references public.care_groups(id) on delete cascade not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.care_relationships
    add constraint care_relationships_linked_by_fkey
    foreign key (linked_by) references public.profiles(id) on delete set null not valid;
exception when duplicate_object then null;
end $$;

create index if not exists care_relationships_active_member_idx
  on public.care_relationships (member_id, relationship_type, senior_id)
  where status = 'active';

create index if not exists care_relationships_group_idx
  on public.care_relationships (care_group_id)
  where status = 'active';

alter table public.care_groups enable row level security;

drop policy if exists care_groups_select_member on public.care_groups;
create policy care_groups_select_member on public.care_groups
  for select to authenticated
  using (
    senior_id = (select auth.uid())
    or exists (
      select 1 from public.care_relationships cr
      where cr.care_group_id = care_groups.id
        and cr.member_id = (select auth.uid())
        and cr.status = 'active'
        and (cr.ends_at is null or cr.ends_at > now())
    )
  );

drop policy if exists care_relationships_select_member on public.care_relationships;
create policy care_relationships_select_member on public.care_relationships
  for select to authenticated
  using (
    senior_id = (select auth.uid())
    or member_id = (select auth.uid())
  );

revoke all on table public.care_groups from anon, authenticated;
grant select on table public.care_groups to authenticated;
grant select on table public.care_relationships to authenticated;
