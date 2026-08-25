# 개발 로그

## 2026-08-25 — Phase 0: 기반과 비밀정보 보호

- 목표: Next.js/TDD 기반과 `.env` 보호를 설정한다.
- Red: 환경 변수 이름만 반환하는 테스트를 먼저 추가했다.
- Green: `.gitignore`, 빈 `.env.example`, 중앙 모델 설정을 추가했다.
- Refactor: 모델 ID 접근을 `lib/config.ts`로 통합했다.
- 의사결정: 실제 API는 호출하지 않고 fixture adapter만 사용한다.

## 2026-08-25 — Phase 1~7: 돌봄 협업 MVP

- 목표: 역할별 UI, 요청·긴급 수직 흐름, 동의/문서 계약, fixture 시설 조회와 복구 UX를 구현한다.
- Red: 권한, 상태 전이, 긴급 부정 표현, 문서 형식, API 입력 검증 테스트를 먼저 작성했다.
- Green: 노인/가족/사회복지사 페이지와 App Router API route, in-memory repository를 구현했다.
- Refactor: domain policy와 server adapter를 분리하고 디자인 토큰을 CSS 변수로 통합했다.
- 변경: 모든 AI 생성 콘텐츠에 AI 표시, 음성 제어, 데모 고지와 실제 발신 방지 문구를 적용했다.
- 알려진 제한: Realtime/Supabase/OpenAI/Public API는 사용자 승인 전 mock 모드다.
- 검증: `npm test -- --run` 25개 통과, `npm run typecheck` 통과, `npm run lint` 통과, `npm run build` 산출물 생성, `npm run test:e2e -- --workers=1` 3개 통과.
