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
