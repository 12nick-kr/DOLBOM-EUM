# Supabase 전화번호형 아이디 전환

이 앱의 `010-0000-0001` 형식 값은 연락처가 아니라 로그인 아이디다. Supabase Phone provider와 SMS는 사용하지 않으며, 서버가 아이디를 `01000000001@id.dolbomeum.invalid` 형태의 비공개 Auth 이메일로 변환한다.

## 적용 순서

1. Supabase SQL Editor에서 `0010_login_id_auth.sql`을 적용한다.
2. 기존 프로필의 `login_id`가 모두 올바르게 백필됐는지 확인한다.
3. 로컬 서버 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 설정한다.
4. `npm run auth:migrate-login-id`로 dry-run 결과를 확인한다.
5. `npm run auth:migrate-login-id -- --apply`로 기존 Auth UUID에 내부 이메일 식별자를 추가한다.
6. 기존 PIN으로 로그인되는지 노인·부양가족·사회복지사 계정을 각각 확인한다.
7. 현재 애플리케이션을 배포한다.
8. Supabase Authentication > Providers에서 Email provider는 켜고 Phone provider는 끈다.
9. 회원가입, 재로그인, 역할별 리다이렉트, 계정 연결을 다시 확인한다.
10. 마지막으로 `0011_drop_phone_alias.sql`을 적용한다.

`scripts/migrate-login-identities.ts`는 기본적으로 DB를 변경하지 않는다. `--apply`가 있을 때만 Admin API를 호출하며, 기존 사용자를 삭제하거나 새 UUID를 만들지 않는다. PIN 값과 내부 이메일 전체는 로그에 출력하지 않는다.

## 운영 제약

- 이메일이나 SMS를 사용하지 않으므로 사용자의 셀프 비밀번호 복구는 제공하지 않는다.
- PIN 분실 시 관리자가 Supabase Admin API로 새 숫자 6자리 PIN을 설정한다.
- 숫자 6자리 PIN은 데모 전용이다. 운영 서비스로 전환할 때는 더 긴 비밀번호 또는 별도 인증 수단이 필요하다.
- 사회복지사 자가 가입은 데모에서만 허용한다. 운영 전에는 관리자 생성 방식으로 제한한다.
