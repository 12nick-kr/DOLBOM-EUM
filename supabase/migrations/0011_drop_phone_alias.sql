-- 0010에서 login_id 백필과 검증이 끝난 뒤 더 이상 인증·검색에 쓰지 않는 과거 컬럼을 제거한다.
drop index if exists public.profiles_phone_alias_unique;

alter table public.profiles
  drop column if exists phone_alias;
