-- 가상 전화번호 + 숫자 6자리 데모 계정을 Supabase Auth 사용자와 연결한다.
alter table public.profiles
  add column if not exists phone_alias text,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_phone_alias_unique
  on public.profiles (phone_alias)
  where phone_alias is not null;

-- 기존 합성 데모 프로필은 auth.users 행이 없으므로 NOT VALID로 추가한다.
-- 이후 생성되는 실제 데모 계정은 즉시 FK 검사를 받는다.
do $$
begin
  alter table public.profiles
    add constraint profiles_auth_user_id_fkey
    foreign key (id) references auth.users(id) on delete cascade not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
