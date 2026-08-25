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

## 2026-08-25 — Phase 0 (재검증): PRD v1.3/DESIGN.md 갱신에 따른 저장소 안전 기반선 재확인

- 목표: `PRD_돌봄이음_AI.md` v1.3, `DESIGN.md`, `CODEX_TERRA_TDD_통합_프롬프트.md` 재작성에 맞춰 Phase 0 완료 조건을 다시 검증하고, Phase 1 이후 착수 전 품질 게이트를 그린 상태로 만든다.
- PRD 요구사항: §11.2(OpenAI 자격증명 단일화), §11.3(Supabase/공공데이터/Kakao 변수), Phase 0 완료 조건(실키 없이 테스트 실행, `.env` 미staged, `index.html` 보존, 품질 게이트 통과).
- Red: 품질 게이트를 그대로 실행해 `npm run lint`가 `next-env.d.ts`의 triple-slash reference 규칙 위반으로 실패하는 것을 확인했다(1 error). 이 파일은 Next.js가 자동 생성하며 "편집하지 말 것"이 명시된 파일이라 소스 수정이 아니라 lint 설정에서 제외하는 것이 올바른 수정이다.
- Green: `eslint.config.mjs`의 `ignores` 배열에 `next-env.d.ts`를 추가해 lint가 자동 생성 파일을 검사하지 않도록 했다.
- Refactor: 별도 리팩터 없음(설정 1줄 변경).
- 변경 파일: `eslint.config.mjs`, `docs/DEVELOPMENT_LOG.md`.
- 검증 명령과 결과:
  - `git status --short` / `git diff --cached --name-only`: `.env` 계열 파일 미staged, 실제 값 없음 확인.
  - `.gitignore`: `.env*`, `!.env.example`, `node_modules/`, `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo` 모두 존재 — PRD 요구 규칙과 일치.
  - `.env.example`: `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`, `OPENAI_TEXT_MODEL=gpt-5.6-terra`, `OPENAI_TRANSCRIBE_MODEL=gpt-transcribe`, `OPENAI_TTS_MODEL=gpt-4o-mini-tts`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATA_GO_KR_SERVICE_KEY`, `KAKAO_REST_API_KEY` — PRD §11.2/§11.3 블록과 이름·순서까지 일치, 실제 값 없음. 단일 `OPENAI_MODEL` 변수는 이미 존재하지 않음(§11.2가 지시한 제거가 이미 반영됨).
  - `npm test -- --run`: 4 test files, 25 tests 통과.
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 수정 후 오류 없음(수정 전 1 error).
  - `npm run build`: 정적/동적 라우트 18개 모두 생성 성공.
- 의사결정: Phase 0의 기존 산출물(`.gitignore`, `.env.example`, `lib/config.ts`, `docs/DEVELOPMENT_LOG.md` 최초 항목)은 새 PRD v1.3/TDD 프롬프트 기준을 이미 만족하므로 재작성하지 않고 보존한다. 발견된 유일한 결함(lint)만 최소 수정한다.
- 알려진 제한/다음 단계: Phase 1(디자인 토큰·역할별 라우트 접근 가드)로 진행한다. `git remote -v`에 `origin`이 이미 설정되어 있음을 확인했으나 이번 작업 범위(Phase 0~5)에서는 push를 수행하지 않는다.
- 예정 커밋 메시지: `chore: TDD 개발 기반과 비밀정보 보호 설정 점검`

## 2026-08-25 — Phase 1: 디자인 토큰과 역할별 접근 가능한 화면 골격

- 목표: `DESIGN.md` §2 토큰을 `app/globals.css`의 CSS 변수로 이식하고, 밀도 스케일(`data-density="comfort"`)을 구현하며, 역할별 라우트 접근 가드를 강화한다.
- PRD/설계 요구사항: `DESIGN.md` §2(토큰)·§4(컴포넌트 규칙: 그림자 금지)·§8(하지 말 것), PRD FR-01(다른 역할 경로 직접 접근 차단), TDD 프롬프트 Phase 1 테스트 목록.
- Red:
  1. `tests/middleware.test.ts`를 새로 작성해 `demo-role` 쿠키가 없는 세션이 `/worker` 같은 보호 경로에 200으로 접근되는 현재 동작(기대치 307)을 실패로 재현했다. 기존 `middleware.ts`는 쿠키가 있고 **불일치**할 때만 리다이렉트했고, 쿠키가 아예 없을 때는 그대로 통과시켰다 — FR-01 위반.
  2. `tests/session-route.test.ts`를 작성해 `@/app/api/session/[role]/route`가 존재하지 않아 import 자체가 실패하는 것을 확인했다(역할 선택 시 쿠키를 설정하는 서버 경로가 아예 없었음 — 랜딩 페이지 역할 카드가 순수 `<Link>`였다).
  3. `tests/SeniorExperience.test.tsx`에 밀도 토큰 검증 케이스를 추가해 `data-density="comfort"`가 렌더 트리에 없는 것을 실패로 확인했다.
  4. `npm run lint`를 재실행해 `app/globals.css` 리라이트 전 상태(그림자 `box-shadow`, 비토큰 hex/px 값 다수)를 육안 대조로 재확인했다(자동 lint 규칙이 아니라 DESIGN.md §8 수동 대조).
- Green:
  - `middleware.ts`: 쿠키가 없으면 `/`로, 있고 불일치하면 해당 역할로 리다이렉트하도록 최소 수정.
  - `app/api/session/[role]/route.ts` 신설: `roleSchema`로 역할을 검증하고 `httpOnly` `demo-role` 쿠키를 설정한 뒤 해당 역할 화면으로 307 리다이렉트. 잘못된 역할은 400.
  - `app/page.tsx`의 역할 카드 링크를 `/senior` 등 직접 경로에서 `/api/session/{role}`로 변경.
  - `e2e/core-flows.spec.ts`의 `page.goto()`를 동일하게 `/api/session/{role}`로 갱신해 이미 통과하던 E2E 흐름이 새 가드에서도 깨지지 않게 했다(Phase 8 범위는 아니지만 회귀 방지를 위해 최소 반영).
  - `app/globals.css` 전체 재작성: DESIGN.md §2.1의 색 이름(`--blue`, `--blue-strong`, `--blue-bg`, `--red`/`--red-bg`, `--amber`/`--amber-bg`, `--mint`/`--mint-bg`, `--ink`/`--ink-2`/`--ink-3`, `--line`, `--surface`, `--bg`, `--bg-alt`)을 그대로 사용. §2.3의 4배수 간격 스케일(`--space-4`~`--space-48`)과 `--radius-card`/`--radius-control`/`--radius-pill`, `--gap-card`/`--gap-stack`/`--gap-page`를 도입. §2.2의 타이포를 역할 이름(`--text-display`/`--text-title`/`--text-body`/`--text-label`)으로만 참조하도록 통합. §2.4의 밀도 스케일을 `:root[data-density='comfort']`(및 하위 요소 선택자)로 구현해 노인 화면(`SeniorExperience`)의 `<main>`에만 `data-density="comfort"`를 부여했다 — 별도 컴포넌트를 만들지 않고 같은 클래스를 재사용한다.
  - DESIGN.md §4/§8 규칙에 따라 카드류 선택자(`.card`, `.role-card`, `.request-card` 등)에서 `box-shadow`를 전부 제거하고 1px `--line` 테두리만 남겼다.
  - `SeniorExperience.tsx`에 `data-density="comfort"` 속성 1곳 추가.
- Refactor: 색상표를 목업 파생 이름(`--blue-dark`, `--surface`가 회색으로 오용되는 등)에서 DESIGN.md 정의 이름으로 정정하고, 페이지 배경(`--bg`)과 카드 배경(`--surface`)의 의미를 DESIGN.md와 일치시켰다(기존 CSS는 `--surface`를 회색 배경으로, `--page`를 별도로 뒀으나 DESIGN.md는 `--surface`=카드 흰색, `--bg`=페이지 배경, `--bg-alt`=카드 안쪽 블록으로 구분).
- 변경 파일: `app/globals.css`(전면 재작성), `middleware.ts`, `app/api/session/[role]/route.ts`(신규), `app/page.tsx`, `components/SeniorExperience.tsx`, `e2e/core-flows.spec.ts`, `tests/middleware.test.ts`(신규), `tests/session-route.test.ts`(신규), `tests/SeniorExperience.test.tsx`.
- 검증 명령과 결과:
  - `npm test -- --run`: 6 test files, 33 tests 통과(기존 25 + 신규 8).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트(신규 `/api/session/[role]` 포함) 모두 생성 성공.
- 의사결정: `data-density`는 `<html>`이 아니라 노인 화면 루트 `<main>`에 부여했다 — Server Component인 `RootLayout`이 경로별로 `<html>` 속성을 분기하려면 미들웨어 헤더 전달 등 추가 배선이 필요해 3일 MVP 범위에서 과설계로 판단했다. CSS 선택자를 `:root[data-density='comfort'], [data-density='comfort']`로 넓혀 두 방식 모두 지원하므로 향후 `<html>` 방식으로 옮겨도 스타일 변경이 필요 없다.
- 알려진 제한/다음 단계: `FamilyDashboard`/`WorkerDashboard`는 이번 Phase에서 클래스명을 그대로 유지했고(마크업 자체는 Phase 4에서 실데이터 배선과 함께 다시 손댈 예정), 지금은 토큰화된 CSS 위에서 기존 레이아웃을 그대로 재사용한다. Playwright E2E(`npm run test:e2e`)는 Phase 8 범위라 이번 실행에서는 구동하지 않았다 — dev 서버 기동이 필요해 별도 확인 대상이다. Phase 2로 진행한다.
- 예정 커밋 메시지: `feat: 디자인 토큰과 역할별 접근 가능한 화면 골격 구현`
