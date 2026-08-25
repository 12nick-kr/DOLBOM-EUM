-- 담당자가 요청 상세 화면에서 남기는 메모. 500자 제한은 애플리케이션(zod) 레벨에서만 강제한다.
alter table public.service_requests
  add column if not exists memo text;
