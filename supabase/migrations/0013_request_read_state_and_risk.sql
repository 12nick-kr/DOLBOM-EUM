-- 서버의 안전 분류 결과를 요청 카드에 보존한다.
-- 사회복지사의 확인 여부는 기존 service_requests.acknowledged_at/by를 정본으로 사용한다.
alter table public.service_requests
  add column if not exists risk_level text not null default 'normal',
  add column if not exists risk_reasons jsonb not null default '[]'::jsonb,
  add column if not exists risk_reviewed_at timestamptz,
  add column if not exists risk_reviewed_by uuid references public.profiles(id) on delete set null;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_risk_level_check
    check (risk_level in ('normal', 'attention', 'emergency'));
exception
  when duplicate_object then null;
end $$;
