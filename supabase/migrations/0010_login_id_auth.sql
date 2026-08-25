-- 화면에는 전화번호처럼 보이지만 실제 연락처가 아닌 로그인 아이디를 저장한다.
-- Supabase Phone provider/SMS는 사용하지 않고 서버가 이 값을 내부 Auth 이메일로 변환한다.
alter table public.profiles
  add column if not exists login_id text;

update public.profiles
set login_id = regexp_replace(phone_alias, '\D', '', 'g')
where login_id is null
  and phone_alias is not null;

create unique index if not exists profiles_login_id_unique
  on public.profiles (login_id)
  where login_id is not null;

do $$
begin
  alter table public.profiles
    add constraint profiles_login_id_format_check
    check (login_id is null or login_id ~ '^0100000[0-9]{4}$') not valid;
exception when duplicate_object then null;
end $$;

alter table public.profiles
  validate constraint profiles_login_id_format_check;

comment on column public.profiles.login_id is
  '전화번호 형태의 로그인 아이디. 실제 전화번호/SMS 인증 값이 아니며 숫자 문자열로만 저장한다.';
