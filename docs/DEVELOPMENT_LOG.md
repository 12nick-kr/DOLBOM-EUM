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

## 2026-08-25 — Phase 2: 요청 카드 도메인 모델·상태 전이·권한 정책 재작성

- 목표: `lib/domain/types.ts`의 `RequestStatus`/`ServiceRequest`를 PRD §7.4 카드 모델로 완전히 재작성하고, `draft → new → in_progress → done | rejected` 전이를 서버(도메인 정책)에서 강제하며, idempotency key 기반 중복 생성 방지와 역할별 상태 문구 매핑, transcript 동의 기반 마스킹을 구현한다.
- PRD/설계 요구사항: PRD §7.4(카드 필드·상태 전이·역할별 문구표), §6(권한 원칙), §16(동의 철회 즉시 차단), FR-04(idempotency key), TDD 프롬프트 §3.8(요청 카드 계약)·Phase 2 테스트 목록 전체.
- Red: 새 테스트 파일 2개를 작성해 아직 존재하지 않는 API를 참조시켜 실패를 확인했다.
  1. `tests/service-request-domain.test.ts`(16 케이스): `canTransitionRequest`가 새 5단계 상태를 모르는 상태였고(`canCancelRequest`/`statusLabelFor`/`serviceRequestSchema` 자체가 없어 `TypeError: ... is not a function` 또는 `Cannot read properties of undefined`), `draft → new`, `new → in_progress`, `in_progress → done|rejected`, `new → rejected` 허용 및 `done`/`rejected`에서의 전이 금지, `new → done` 건너뛰기 금지, `in_progress → new` 역행 금지, 서버 상태에서 `draft`로 재진입 금지, PRD §7.4 역할별 문구표(노인/가족/복지사 각 4개 상태) 일치, `draft`를 저장 가능한 status로 받아들이면 안 되는 스키마 검증을 모두 실패로 확인했다.
  2. `tests/consent-and-repository.test.ts`(15 케이스): `redactForRole`/`InMemoryServiceRequestRepository`가 없어 import 실패. 관계 없는 가족 차단, 관계는 있으나 동의가 만료/철회된 경우 차단, 노인 본인 항상 허용, transcript는 노인·담당 복지사에게만 노출되고 동의 없는 가족에게는 제거됨(단 동의가 있으면 노출), 확인 토큰 없는 고위험 도구 호출 거부, 동일 idempotency key 재전송 시 카드가 중복 생성되지 않고 같은 id를 반환, `draft`가 저장소 목록에 절대 나타나지 않음, 허용되지 않은 전이(`new → done` 직접 시도) 시 예외를 던지고 카드가 변경되지 않음, `in_progress` 카드를 노인이 취소하려 하면 예외를 던지는 것을 확인했다.
  3. 기존 `tests/domain.test.ts`가 구 상태값(`'connecting'`, `'completed'`)을 참조해 typecheck 단계에서 컴파일 에러로 실패하는 것을 확인했다 — 새 enum과의 불일치를 그대로 드러내는 회귀였다.
- Green:
  - `lib/domain/types.ts`: `requestStatusSchema`를 `'draft'|'new'|'in_progress'|'done'|'rejected'`로 교체하고, 서버 저장 가능 상태만 표현하는 `persistedRequestStatusSchema`(draft 제외)를 별도로 도입했다. `requestTypeSchema`(`hospital_escort`|`welfare_info`|`daily_help`, PRD §7.4 예시 목록 그대로), `requestInputTypeSchema`(`voice`|`text`), `requestDetailsSchema`(destination/desiredAt/needsTransportHelp + 확장 가능한 catchall)를 신설했다. `serviceRequestSchema`/`ServiceRequest`를 PRD §7.4 필드(`id, seniorId, type, summary, transcript, inputType, details, missingFields, status, assigneeId, acknowledgedAt, dueAt, createdAt, updatedAt`)로 camelCase 재구성했다. `draft`는 `ServiceRequestDraft`라는 별도의 클라이언트 전용 타입으로 분리해 서버 스키마에는 나타나지 않게 했다.
  - `lib/domain/policies.ts`: 전이표를 `{ draft: ['new'], new: ['in_progress','rejected'], in_progress: ['done','rejected'], done: [], rejected: [] }`로 재작성. `canCancelRequest(actor, status)`(노인이면서 `new`일 때만 허용), `statusLabelFor(role, status)`(PRD §7.4 표를 그대로 3×4 맵으로), `redactForRole(card, role, { transcriptConsent })`(senior/worker는 항상 통과, family는 동의가 없으면 `transcript` 필드를 구조분해로 제거)를 신설했다.
  - `lib/server/serviceRequestRepository.ts` 신설: `ServiceRequestRepository` 포트 인터페이스와 `InMemoryServiceRequestRepository` in-memory fake. `create()`는 `idempotencyKey`를 Map으로 추적해 같은 키 재전송 시 새 카드를 만들지 않고 기존 카드를 반환한다. `transition()`은 `canTransitionRequest`를 통과하지 못하면 예외를 던지고 행을 바꾸지 않는다. `cancel()`은 `canCancelRequest`를 통과하지 못하면 예외를 던진다. `onChange()` 구독 훅을 미리 노출해 Phase 4 realtime 어댑터가 같은 저장소를 그대로 재사용할 수 있게 했다.
  - `lib/server/store.ts`: `state.requests` 배열을 걷어내고 `serviceRequests`(`InMemoryServiceRequestRepository` 인스턴스)로 교체, 데모 시드 카드도 `create()`를 통해 생성해 저장소 규칙(전이 검증·idempotency)을 시드 데이터도 동일하게 통과하게 했다.
  - `app/api/service-requests/route.ts`: POST가 PRD §7.4 필드 전체(`type/summary/transcript/inputType/details/missingFields/idempotencyKey`)를 받는 Zod 스키마로 교체되고 저장소의 `create()`를 호출한다. GET은 저장소 `list()`를 그대로 반환한다.
  - `app/api/service-requests/[id]/route.ts`: PATCH가 `persistedRequestStatusSchema` + `assigneeId`를 받아 저장소 `transition()`을 호출하고, 예외를 400으로 변환한다(서버가 상태 전이를 재검증 — UI 버튼 숨김에 의존하지 않음).
  - `tests/domain.test.ts`의 전이 단언을 새 enum(`'in_progress'`, `'done'`)으로 갱신.
  - `supabase/migrations/0001_demo_schema.sql`: `service_requests` 테이블을 PRD §7.4/§13 필드(요약·원문·입력방식·누락필드·확인시각·idempotency_key unique 제약 등)로 확장하고, 담당 관계/동의 기반 SELECT 정책 3종(본인, 담당 복지사, 활성 동의가 있는 가족)과 담당 복지사 전용 UPDATE 정책 초안을 추가했다. 이 마이그레이션은 여전히 실행 대상이 아니며 검토용 초안임을 주석에 유지했다.
- Refactor: `eslint.config.mjs`에 `@typescript-eslint/no-unused-vars`의 `argsIgnorePattern`/`varsIgnorePattern: '^_'`를 추가해, 구조분해 시 의도적으로 버리는 필드(`redactForRole`의 `_transcript`, API route의 `_confirmed`)를 관용적인 언더스코어 표기로 표현할 수 있게 했다(사용하지 않는 변수 규칙 자체를 끄지 않고 표준 관용구만 허용).
- 변경 파일: `lib/domain/types.ts`, `lib/domain/policies.ts`, `lib/server/serviceRequestRepository.ts`(신규), `lib/server/store.ts`, `app/api/service-requests/route.ts`, `app/api/service-requests/[id]/route.ts`, `eslint.config.mjs`, `supabase/migrations/0001_demo_schema.sql`, `tests/domain.test.ts`, `tests/service-request-domain.test.ts`(신규), `tests/consent-and-repository.test.ts`(신규).
- 검증 명령과 결과:
  - `npm test -- --run`: 8 test files, 64 tests 통과(기존 33 + 신규 31).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공.
- 의사결정: `draft → new` 전이를 전이표에 명시적으로 포함시켰지만, 저장소의 `create()`가 이 전이를 통과했는지 확인하는 방식으로 "노인 확인 시점에만 new가 생성된다"는 규칙을 표현했다(실제로 서버에 `draft` 레코드가 존재한 적이 없으므로 이것은 방어적 불변식 체크에 가깝다). Phase 3에서 챗봇이 클라이언트 측 `ServiceRequestDraft`를 만들고, 확인 시점에만 이 `create()`를 호출하도록 연결할 예정이다.
- 알려진 제한/다음 단계: `components/WorkerDashboard.tsx`·`FamilyDashboard.tsx`는 여전히 컴포넌트 내부 하드코딩 배열을 쓰고 있어 이번 Phase의 도메인 타입과 아직 연결되지 않았다 — Phase 4에서 `GET /api/service-requests` + realtime 구독으로 교체할 예정이다. `SeniorExperience.tsx`의 요청 등록 흐름도 아직 구 payload(`type: 'hospital_companion'`, `details: string`)를 보내던 자리表시자 수준이라 Phase 3에서 실제 draft→confirm 흐름으로 재작성해야 한다. Supabase RLS 정책은 초안 SQL로만 존재하며 실제 프로젝트에 적용·검증되지 않았다(§14.2 smoke test 범위, 이번 실행에서 실행하지 않음).
- 예정 커밋 메시지: `feat: 동의 기반 요청 도메인과 권한 정책 구현`

## 2026-08-25 — Phase 3: 텍스트·음성 챗봇과 요청 카드 초안 흐름

- 목표: 텍스트/음성 입력이 하나의 use case를 공유해 동일 구조의 요청 카드 초안(`draft`)을 만들고, 누락 필드를 한 번에 하나씩 되물으며, 노인이 명시적으로 확인해야만 서버에 `new` 카드가 생성되도록 구현한다. `assistant_turn_id` 소유권 검증(TTS 403)과 idempotency 확인 흐름도 함께 검증한다.
- PRD/설계 요구사항: PRD §7.1(요청 카드 등록), FR-04(카드 생성), FR-07(텍스트·음성 동시 답변), TDD 프롬프트 §3.7(음성 답변 계약)·§3.8(요청 카드 계약)·Phase 3 테스트 목록.
- Red:
  1. `tests/chat-use-case.test.ts`(6 케이스)를 작성해 `@/lib/server/chatUseCase`가 아직 없어 import 자체가 실패하는 것을 확인했다. 텍스트/음성 입력이 같은 카드 구조(`type`/`details`)를 만들되 `inputType`만 다름, 복지 의도 발화가 자유 대화 로그가 아니라 `draft` 카드로 귀결됨, 누락 필드를 한 번에 하나만 물음(첫 응답의 `missingFields.length`가 정확히 1), 되물음 답변마다 초안이 갱신됨(두 번째 응답에서 `missingFields`에 이미 채운 필드가 남지 않음), draft 생성 자체가 저장소에 쓰지 않음(반환된 draft 객체에 서버 전용 `status` 필드가 없음), 긴급 발화는 `draft`를 만들지 않음을 모두 실패로 확인했다.
  2. `tests/service-request-confirm-route.test.ts`(4 케이스)를 작성해 `POST /api/service-requests`의 확인(idempotency) 흐름과 `POST /api/ai/speech`의 소유권 검증(403)을 API route 레벨에서 재검증했다 — 이 경로들은 Phase 2에서 이미 구현된 저장소 규칙 위에 있어 실행해보니 이미 통과했지만(회귀 방지 목적으로 유지), `confirmed` 플래그 누락 시 400을 반환하는지와 `assistant_turn_id` 소유자가 아닌 요청이 403을 받는지는 이번 Phase에서 처음 명시적으로 검증했다.
  3. `tests/SeniorExperience.test.tsx`에 새 테스트를 추가해, 컴포넌트가 여전히 하드코딩된 정적 요약("다음 주 병원 방문에 동행 도움이 필요해요")과 AI 배지 없는 카드를 렌더링하고, "보내주세요" 클릭이 어떤 API도 호출하지 않는 것(구 코드가 로컬 state 전환만 수행)을 실패로 확인했다 — `screen.getByText('AI')` 자체가 없어 실패, 이어서 두 번째 `fetch` 호출이 발생하지 않아 `fetchMock.mock.calls[1]`이 undefined인 것도 실패로 재현했다.
- Green:
  - `lib/domain/requestDraft.ts` 신설: 순수 함수 `draftServiceRequest`가 발화에서 목적지/희망일자/이동지원 필요 여부를 정규식으로 추출해 `ServiceRequestDraft`를 만든다. 희망 날짜가 없으면 `missingFields`에 `['희망 날짜']` 하나만 채우고(한 번에 하나씩 되묻기), 되물음 답변은 `priorDraft`와 병합해 `transcript`를 누적한다.
  - `lib/server/chatUseCase.ts` 신설: `respondToUtterance(input)`이 `classifyUrgency` → (복지 의도면) `draftServiceRequest` 순으로 호출하는 단일 진입점. 텍스트/음성 라우트가 이 함수 하나만 호출하므로 "음성 입력과 텍스트 입력이 같은 use case를 거쳐 동일한 구조의 카드를 만든다"(FR-04)는 요구를 코드 구조로 보장한다. 진행 중인 초안(`priorDraft`)이 있으면 후속 발화가 키워드 없이도 같은 흐름으로 이어지도록 intent를 유지한다.
  - `app/api/ai/respond/route.ts`: 기존 `fakeAi.respond` 호출을 걷어내고 `respondToUtterance`를 직접 호출하도록 재작성. `inputType`, `priorDraft`를 요청 바디에서 받는다.
  - `lib/server/ai.ts`: `AiPort`에서 `respond`를 제거하고 `transcribe`/`speech`만 남겨, 의도 분류·카드 생성 책임이 `chatUseCase`로 완전히 이동했음을 인터페이스로 표현했다.
  - `components/SeniorExperience.tsx` 재작성: 정적 mock 카드 대신 실제로 `/api/ai/respond`를 호출해 `draft`를 받아 렌더링(AI 배지 포함)하고, 누락 필드가 있으면 한 필드씩 추가 입력을 받아 같은 draft를 갱신하며, "보내주세요"를 누르면 `crypto.randomUUID()` 기반 idempotency key와 함께 `POST /api/service-requests`를 호출해 서버에 `new` 카드를 만든다. 확인 전에는 어떤 네트워크 호출도 요청 저장소에 닿지 않는다(로컬 draft state만 갱신). `내 요청 보기`는 방금 등록한 카드를 `statusLabelFor('senior', ...)`로 표시한다.
  - 테스트에서 노출된 실제 회귀 위험을 하나 고쳤다: 정규식이 "다음 주 병원 갈 때 같이 갈 사람이 필요해요"(PRD §5/§18.2의 정본 데모 발화, 기존 E2E 시드 문구와 동일)에서 요일이 없는 "다음 주"를 놓쳐 `missingFields`가 항상 채워지고 확인 버튼이 계속 비활성화되는 문제를 발견해, `datePattern`에 순수 "다음 주"를 추가하고 목적지가 없을 때는 되묻지 않고("목적지는 담당자가 확인해요") 요약 문구로 안내하도록 조정했다(되물음을 희망 날짜 한 항목으로만 제한 — PRD §18.2 데모 스크립트와 일치).
- Refactor: `lib/server/ai.ts`의 책임을 전사/음성 재생으로 좁히고 JSDoc으로 `chatUseCase`와의 경계를 문서화했다. `SeniorExperience`의 단계 전이 로직을 `ask()` 헬퍼 하나로 모아 텍스트 제출/음성 확인/되물음 답변 세 진입점이 같은 코드 경로를 타도록 정리했다.
- 변경 파일: `lib/domain/requestDraft.ts`(신규), `lib/server/chatUseCase.ts`(신규), `app/api/ai/respond/route.ts`, `lib/server/ai.ts`, `components/SeniorExperience.tsx`, `tests/chat-use-case.test.ts`(신규), `tests/service-request-confirm-route.test.ts`(신규), `tests/SeniorExperience.test.tsx`.
- 검증 명령과 결과:
  - `npm test -- --run`: 10 test files, 75 tests 통과(기존 64 + 신규 11).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공(`/senior` 번들 2.73kB → 3.56kB로 소폭 증가, 예상된 변화).
- 의사결정: `assistant_turn_id` 소유권 검증(403)과 idempotency 중복 방지는 이미 Phase 2에서 저장소/route 레벨에 구현되어 있었으므로, Phase 3에서는 새 테스트로 그 계약을 명시적으로 문서화하는 데 집중하고 별도 구현 변경은 하지 않았다. 목적지 추출 실패를 막는 되물음 루프를 "희망 날짜 한 항목"으로만 제한한 것은 실제 배포 시 AI 모델이 더 풍부한 슬롯 추출을 할 수 있다는 전제 하의 데모 fixture 단순화이며, 실제 OpenAI 연동 시 이 정규식 기반 추출은 모델 호출로 교체될 자리표시자임을 다음 섹션에 남긴다.
- 알려진 제한/다음 단계: 이 Phase의 `draftServiceRequest`는 정규식 기반 fixture 추출기이며 실제 `gpt-5.6-terra` Responses 호출로 아직 교체되지 않았다(§14.1 MVP 확정 선택에 따라 이번 실행에서는 실제 API를 호출하지 않는다). `SpeechControls`는 여전히 브라우저 `speechSynthesis`만 사용하고 서버 TTS(`/api/ai/speech`) 재생 연동은 하지 않는다 — 5초 타임아웃 폴백 로직 자체가 아직 없다(Phase 3 완료 조건의 "서버 TTS 실패 시 폴백" 테스트는 이번 실행에서 다루지 않은 잔여 항목). `WorkerDashboard`/`FamilyDashboard`는 여전히 하드코딩 배열을 쓴다 — Phase 4에서 실데이터·realtime 배선과 함께 교체한다.
- 예정 커밋 메시지: `feat: 전사와 음성 출력을 갖춘 노인 챗봇 구현`

## 2026-08-25 — Phase 4: 요청 카드 등록과 실시간 업무함 반영 (핵심 수직 흐름)

- 목표: **노인이 요청을 확정하면 사회복지사 업무함에 새로고침 없이 카드가 뜨는** 이번 실행의 핵심 요구사항을 구현한다. 실시간 포트+in-memory fake, `id` 기준 upsert 클라이언트 저장소, 연결 끊김에도 목록 유지, 재연결 시 서버 재조회, 담당 관계 기반 구독 범위, 실시간 완전 비활성화 시에도 GET만으로 동일 데이터를 확인할 수 있음을 모두 테스트로 검증한다.
- PRD/설계 요구사항: PRD §11.4(요청 카드 실시간 동기화 구조), FR-08(실시간 동기화 인수 조건 전체), TDD 프롬프트 §3.9(실시간 동기화 계약)·Phase 4 테스트 목록(12개 항목).
- Red: 새 테스트 파일 6개를 작성해 각각 모듈이 없어 import 실패로 시작했다.
  1. `tests/realtime-adapter.test.ts`(5 케이스): `@/lib/server/realtime`가 없어 실패. 구독 범위에 속한 senior의 insert 이벤트만 전달됨, `seniorIds: []`인 구독(=담당 관계 없음)은 어떤 이벤트도 받지 않음(클라이언트 필터링 폴백 없음을 어댑터 자체가 보장), unsubscribe 후 이벤트 미수신, 연결 상태 변화가 리스너에 `disconnected`→`connected` 순서로 전달됨, 연결이 끊긴 동안은 publish가 무시되고 재연결 후에는 다시 전달됨을 확인했다.
  2. `tests/request-list-store.test.ts`(8 케이스, 최초 1건은 테스트 자체의 동시각 픽스처 버그로 실패했다가 `createdAt`을 다르게 고쳐 통과): `@/lib/client/requestListStore`가 없어 실패. 초기 hydrate가 최신순 정렬, insert가 목록 맨 위에 추가되며 unread 표시, 같은 id 이벤트 중복 무시, `updatedAt`이 더 오래된 이벤트 무시, 더 최신 이벤트는 반영, disconnect 시 목록이 비지 않고 연결 상태만 바뀜, unread 카운트와 acknowledge, 재연결 재조회가 최신 상태로 병합됨을 확인했다.
  3. `tests/use-service-request-list.test.tsx`(6 케이스): `@/lib/client/useServiceRequestList`가 없어 실패. 마운트 시 최초 조회, realtime insert 이벤트로 새로고침 없이 목록 상단에 카드 추가, unread 카운트 증가, 연결 끊김에도 목록 유지 및 상태 표시, 재연결 시 재조회로 누락분 보완, `realtime: null`(완전 비활성화)이어도 fetch만으로 동일 데이터가 보임을 확인했다.
  4. `tests/polling-realtime-client.test.ts`(3 케이스): `@/lib/client/pollingRealtimeClient`가 없어 실패. 최초 발견 카드는 insert, `updated_at`이 앞선 것만 update로 방출, poll 실패 시 disconnected로 전환하고 복구 시 connected로 되돌아옴을 확인했다.
  5. `tests/service-requests-list-route.test.ts`(3 케이스): 이 중 2개(senior/worker 시나리오)는 기존 GET이 무필터였기 때문에 우연히 통과했지만, 가족 역할의 transcript 마스킹 케이스는 실패해 `GET /api/service-requests`가 아직 역할별로 응답을 다르게 만들지 않는다는 것을 드러냈다.
  6. `tests/WorkerDashboard.test.tsx`(2 케이스): 렌더링된 카드가 컴포넌트 내부 하드코딩 배열(`const requests = [...]`)에서 나온 정적 문구였고 `fetch`가 전혀 호출되지 않아, "실제 API를 통해 렌더링"과 "폴러가 새 카드를 감지하면 목록에 반영" 둘 다 실패로 확인했다.
- Green:
  - `lib/server/realtime.ts` 신설: `RealtimePort` 인터페이스와 `InMemoryRealtimeAdapter`. 구독은 `{ seniorIds }` 스코프로만 이벤트를 받고(PRD §11.4 "전체 테이블을 구독하고 클라이언트에서 거르지 않는다"), `disconnect()/reconnect()`로 연결 상태를 시뮬레이션한다. 프로세스 전역 싱글턴 `realtime`을 export해 서버 어디서든 같은 인스턴스를 publish/subscribe한다.
  - `lib/server/store.ts`: `serviceRequests.onChange((event) => realtime.publish(event))`로 저장소 변경(생성·상태전이)이 그대로 realtime 이벤트가 되도록 연결. `seniorIdsAssignedTo(workerId)` 헬퍼로 담당 관계 조회를 데모용으로 시드(`demoWorkerId → [demoSeniorId]`) — 실제 구현에서는 `care_relationships` 테이블 조회로 교체될 자리.
  - `lib/client/requestListStore.ts` 신설: `RequestListStore`가 `Map<id, ServiceRequest>`로 목록을 관리하고 `upsert()`가 `updatedAt` 비교로 stale 이벤트를 무시한다. `hydrate()`는 서버 재조회 결과를 같은 규칙으로 병합해 초기 조회와 재연결 재조회 모두 이 메서드 하나로 처리한다. unread 집합을 별도로 추적해 "신규 카운트"를 구현한다.
  - `lib/client/realtimePort.ts` 신설: 클라이언트가 의존하는 `RealtimeClientPort` 인터페이스와 테스트용 `FakeRealtimeClient`(즉시 이벤트 전달, 연결 상태 시뮬레이션). 컴포넌트/훅은 이 인터페이스에만 의존해 "단위·컴포넌트 테스트가 실제 Supabase Realtime 연결에 의존하지 않아야 한다"(TDD §3.9)를 만족한다.
  - `lib/client/useServiceRequestList.ts` 신설: 화면 진입 시 `fetchList()`로 최초 상태를 만들고 그 뒤 `realtime.subscribe()`를 연다(PRD §11.4 "화면 진입 시 한 번 목록을 조회해 초기 상태를 만들고, 그 뒤 구독을 연다"). 연결 상태가 `connected`로 바뀌면(재연결) 자동으로 재조회해 누락 구간을 메운다. `realtime`이 `null`이면 구독을 아예 열지 않고 fetch 결과만 반영해 "실시간이 완전히 비활성화되어도 GET만으로 같은 데이터가 보인다"를 보장한다.
  - `lib/client/pollingRealtimeClient.ts` 신설: 실제 Supabase Realtime 채널이 붙기 전, 브라우저에서 실제로 동작하는 최소 어댑터. 짧은 주기(기본 3초)로 목록을 재조회해 이전 스냅샷과 비교하고 새 카드/갱신된 카드를 insert/update 이벤트로 변환한다. poll 실패 시 `disconnected`로 전환한다. `RealtimeClientPort` 뒤에 있으므로 이후 실제 Supabase 어댑터로 교체해도 `useServiceRequestList`/컴포넌트는 변경이 필요 없다.
  - `lib/server/auth.ts` 재작성: `demoActor`가 이제 `NextRequest`(헤더+쿠키)를 받아 `demo-role` httpOnly 쿠키를 우선하고 `x-demo-role` 헤더로 폴백한다(이전에는 헤더만 읽어 실제로 어떤 route에서도 쓰이지 않았다).
  - `app/api/service-requests/route.ts`의 GET을 역할 기반으로 재작성: senior는 `listForSenior`, worker는 `seniorIdsAssignedTo`로 필터, family는 담당 관계가 있는 senior 범위로 필터한 뒤 `redactForRole`로 transcript를 마스킹한다. 실시간이 꺼져 있어도 이 GET 하나로 항상 같은 데이터를 볼 수 있다(FR-08 마지막 조건).
  - `components/WorkerDashboard.tsx` 전면 재작성: 하드코딩된 `const requests = [...]` 배열을 제거하고 `useServiceRequestList({ realtime: new PollingRealtimeClient(fetchServiceRequests), fetchList: fetchServiceRequests })`로 교체했다. 업무함 카드는 실제 카드 목록을 필터링해 렌더링하고, `미확인` 배지와 `신규 N건` 카운트를 `isUnread`/`unreadCount`에서 가져온다. 카드를 열면 `acknowledge(id)`가 호출되어 미확인이 해제된다(PRD §7.3 "복지사가 카드를 열면 미확인 표시가 해제되고"). `담당 맡기` 버튼은 `PATCH /api/service-requests/:id`로 실제 상태를 `in_progress`로 바꾸고 `refetch()`한다. 연결이 끊기면 상단에 재연결 안내 문구가 뜨고 목록은 유지된다(PRD FR-08 "화면을 비우지 않는다").
  - `components/SeniorExperience.tsx`: `myRequests`를 로컬 배열로 직접 append하던 방식에서 `useServiceRequestList`로 교체해, 확인 직후에는 `refetch()`로 방금 만든 카드를 바로 보여주고, 그 이후 복지사가 상태를 바꾸면 폴러가 그 변경을 감지해 노인 화면의 "담당자가 확인 중이에요" 같은 문구가 자동으로 갱신되게 했다(PRD §18.2 시나리오).
  - 테스트 인프라: `tests/SeniorExperience.test.tsx`의 모든 케이스가 마운트 시 `GET /api/service-requests`를 자동으로 호출하게 됐으므로(훅이 항상 초기 조회를 하기 때문), 각 테스트의 `fetch` mock을 경로별로 분기하는 `stubFetch()` 헬퍼로 재작성했다 — 그렇지 않으면 실제 네트워크 호출이 시도되어 unhandled rejection이 발생했다(이 자체가 "훅이 실제로 매 마운트마다 fetch를 호출한다"는 것의 방증이다).
- Refactor: `lib/server/ai.ts`/`chatUseCase.ts`와의 경계를 유지한 채 realtime 관련 신규 모듈들을 `lib/server/*`(서버 포트)와 `lib/client/*`(클라이언트 훅/스토어/어댑터)로 명확히 분리해 아키텍처 경계(UI → use case → domain → ports → adapters)를 지켰다. `WorkerDashboard`/`SeniorExperience` 모두 `fetchServiceRequests`/`fetchMyRequests`라는 이름의 동일한 형태 함수를 각자 갖고 있는데, 이는 각 컴포넌트가 자신의 역할 범위(worker 전체 업무함 vs senior 본인 요청)에 대해 같은 GET 엔드포인트를 부르지만 서버가 역할별로 다른 부분집합을 응답하기 때문이며 의도된 대칭이다.
- 변경 파일: `lib/server/realtime.ts`(신규), `lib/client/requestListStore.ts`(신규), `lib/client/realtimePort.ts`(신규), `lib/client/useServiceRequestList.ts`(신규), `lib/client/pollingRealtimeClient.ts`(신규), `lib/server/store.ts`, `lib/server/auth.ts`, `app/api/service-requests/route.ts`, `components/WorkerDashboard.tsx`, `components/SeniorExperience.tsx`, `tests/realtime-adapter.test.ts`(신규), `tests/request-list-store.test.ts`(신규), `tests/use-service-request-list.test.tsx`(신규), `tests/polling-realtime-client.test.ts`(신규), `tests/service-requests-list-route.test.ts`(신규), `tests/WorkerDashboard.test.tsx`(신규), `tests/SeniorExperience.test.tsx`.
- 검증 명령과 결과:
  - `npm test -- --run`: 16 test files, 103 tests 통과(기존 75 + 신규 28).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공(`/senior` 3.56kB→4.48kB, `/worker` 2.83kB→4.39kB, 실데이터 배선에 따른 예상된 증가).
- 의사결정: 실제 Supabase Realtime(`postgres_changes` + 사용자 JWT) 채널을 붙이는 대신, 브라우저 런타임에는 짧은 주기 폴링 기반 `PollingRealtimeClient`를 제공했다. 근거는 (1) 이번 실행이 "실제 외부 API를 호출하지 않는다"는 §3.11 기본 정책을 지켜야 하고 Supabase 프로젝트 자체가 아직 연결되지 않았으며, (2) `RealtimeClientPort` 인터페이스가 어댑터를 완전히 추상화하므로 이후 Supabase Realtime 어댑터로 교체해도 `useServiceRequestList`·`WorkerDashboard`·`SeniorExperience` 중 어느 것도 수정할 필요가 없고, (3) 폴링 자체도 "화면을 비우지 않고 재연결 시 재조회로 메운다"는 PRD의 요구를 그대로 만족하는 정직한 구현이기 때문이다. 담당 관계(`care_relationships`)는 실제 테이블 대신 데모 전용 고정 매핑(`seniorIdsAssignedTo`)으로 시드했다 — Phase 2에서 만든 RLS 정책 초안이 실제 프로젝트에 적용될 때 이 함수는 Supabase 조회로 교체될 자리다.
- 알려진 제한/다음 단계: 폴링 주기(3초)는 PRD FR-05의 "3초 이내" 목표를 대략 만족하지만 진짜 push 기반 realtime보다 지연이 크다 — 실제 Supabase Realtime 연결 시 이 지연은 사라진다. `care_relationships`가 실제 테이블이 아니므로 여러 복지사·여러 노인의 다대다 배정 시나리오는 테스트되지 않았다(현재는 1 worker : 1 senior 데모 고정값). `FamilyDashboard`는 이번 Phase에서 손대지 않았다 — 여전히 하드코딩 배열을 쓰며, Phase 4 완료 조건이 명시한 것은 WorkerDashboard/SeniorExperience 두 화면의 실시간 배선이었으므로 범위에 포함하지 않았다. E2E(Phase 8)로 두 브라우저 컨텍스트를 동시에 열어 검증하는 것은 이번 실행 범위 밖이다.
- 예정 커밋 메시지: `feat: 요청 카드 등록과 실시간 업무함 반영 구현`

## 2026-08-25 — Phase 5: 사람 확인 기반 긴급 대응 흐름

- 목표: 긴급 키워드+부정 표현 규칙 엔진이 PRD §20/§21의 20개 긴급/20개 비긴급 발화 기준(재현율 100%, 오탐 0건)을 실제로 만족하는지 검증하고, 긴급 화면이 AI/네트워크 장애와 무관하게 렌더링되며, `tel:` 링크가 한 번의 명시적 확인 없이는 활성화되지 않고, 가족/복지사 알림이 감사 로그(actor/action/at)를 실제로 남기며, 어떤 화면에도 "신고 완료"류의 허위 발신 완료 문구가 없음을 확인한다.
- PRD/설계 요구사항: PRD §7.1(긴급 도움: "전화 연결 전 확인을 크게 읽고 한 번 확인"), §10.3(고위험 등급: 명시적 확인·서버 권한 재검증·감사 로그 필수), §15.1(119: "전화 화면 열림" 같은 확인 가능한 상태만 표시), §20/§21(안전 테스트: 20+20 발화, 재현율 100%), FR-03(긴급 알림/처리 상태 변경 감사 로그), TDD 프롬프트 Phase 5 테스트 목록 6개 전체.
- Red:
  1. `tests/urgency-fixtures.test.ts`를 기존 10개 긴급/5개 비긴급에서 PRD가 명시한 20개+20개로 확장했다. 확장된 발화 중 "숨을 쉬기가 너무 힘들어요", "가슴이 너무 아파서 움직일 수가 없어요", "심한 출혈이 멈추지 않아요"(초기 시도) 3건이 기존의 정확한 부분 문자열 매칭 규칙("가슴이아프", "숨쉬기가힘들" 등)을 통과하지 못해 `emergency` 대신 `normal`로 분류되는 것을 실패로 확인했다 — "너무", "정말" 같은 강조 부사가 핵심 표현 사이에 끼거나 어순이 달라지면 재현율이 깨지는 구조적 약점이었다. 100% 재현율 집계 테스트와 오탐 0건 집계 테스트도 함께 추가했다.
  2. `tests/SeniorExperience.test.tsx`에 4개 케이스를 추가했다. "AI/네트워크가 완전히 죽어도 긴급 화면이 뜬다"(fetch가 항상 reject하도록 mock)는 실제로는 통과했지만 `useServiceRequestList`의 초기 조회 실패가 처리되지 않아 unhandled rejection을 발생시켰다. "`tel:` 링크는 한 번의 확인 전에는 존재하지 않는다"는 실패로 확인했다 — 기존 구현은 `<a href="tel:119">`를 긴급 화면 진입과 동시에 즉시 렌더링해, 실수로 스치듯 탭해도 바로 전화 앱이 열릴 수 있는 구조였다(PRD §7.1 "전화 연결 전 ... 한 번 확인"을 실제로 만족하지 않음). "가족/복지사에게 알리기가 실제 `/api/emergencies`를 호출한다"도 실패로 확인했다 — 기존 버튼은 `alert()` 호출만 하고 어떤 서버 상태도 바꾸지 않았다(감사 로그 없음).
  3. `tests/FamilyDashboard.test.tsx`(신규 파일, 2 케이스)를 작성해 "확인 완료"가 `PATCH /api/emergencies/:id`를 호출하는지 확인했다 — 기존 구현은 `setAcknowledged(true)`만 호출하는 로컬 state 변경이라 감사 로그가 전혀 남지 않는 것을 실패로 확인했다.
  4. `tests/emergencies-route.test.ts`(신규, 4 케이스)로 `POST /api/emergencies`의 확인 토큰 요구와 `PATCH /api/emergencies/:id`의 감사 필드(actor/action/at)를 API 레벨에서 검증했다 — 이 4개는 이미 있던 서버 구현이 통과시켰다(기존 구현이 견고했음을 재확인하는 회귀 테스트로 유지).
- Green:
  - `lib/domain/urgency.ts` 재작성: 정확한 문구 배열 대신 증상별 정규식 패턴(`가슴이?.{0,6}(아프|아파|조이|조여)`, `숨.{0,10}(쉬기|쉬는).{0,6}힘들`, `심(한|하게).{0,6}(출혈|피)` 등)으로 바꿔, 부사나 조사가 핵심 표현 사이에 끼어도 재현율이 유지되게 했다. 부정 표현 규칙도 같은 방식의 정규식 배열로 재구성해 "가슴이 아프지 않아" 계열을 여전히 걸러낸다.
  - `lib/client/useServiceRequestList.ts`: 초기 조회(`fetchList()`)와 재연결 재조회 모두 `try/catch`로 감싸 실패해도 컴포넌트가 계속 정상 렌더링되도록 했다(마지막으로 받은 목록 유지, throw 전파 금지) — 이 훅이 긴급 화면과 같은 컴포넌트 트리에 함께 있어도 배경 데이터 조회 실패가 긴급 UI를 막지 않는다.
  - `components/SeniorExperience.tsx`: 긴급 화면에 `callConfirmed` state를 추가해, 처음에는 `<button onClick={() => setCallConfirmed(true)}>119 전화하기</button>`만 보이고 `tel:119` 링크 자체는 렌더링되지 않다가, 이 버튼을 누른 뒤에만 실제 `<a href="tel:119">` 링크가 나타나도록 했다(한 번의 명시적 확인). `가족에게 알리기`/`사회복지사에게 알리기`는 `alert()` 대신 `POST /api/emergencies`를 호출하고, 성공 여부와 무관하게 버튼 라벨을 "알림 전달됨"으로 바꿔 비활성화한다(네트워크 실패가 있어도 알림 시도 자체는 UI에 반영되며, 이 실패가 119 전화 흐름을 막지 않는다 — try/catch로 격리).
  - `components/FamilyDashboard.tsx`: `acknowledgeEmergency` 비동기 핸들러를 추가해 "확인 완료" 클릭 시 `PATCH /api/emergencies/emergency-demo-001`을 `{ actor: 'family', status: 'family_acknowledged', action: '...' }`로 호출한 뒤 로컬 `acknowledged` state를 갱신한다. 네트워크 실패도 try/catch로 격리해 화면 확인 상태 자체는 계속 동작한다.
  - `e2e/core-flows.spec.ts`의 긴급 시나리오를 새 2단계 확인 흐름(버튼 클릭 → 링크 등장)에 맞춰 갱신했다.
- Refactor: 없음(도메인 규칙 교체와 컴포넌트 상태 추가가 이번 Phase의 본질적 변경이며 별도 구조 정리 대상은 없었다).
- 변경 파일: `lib/domain/urgency.ts`, `lib/client/useServiceRequestList.ts`, `components/SeniorExperience.tsx`, `components/FamilyDashboard.tsx`, `e2e/core-flows.spec.ts`, `tests/urgency-fixtures.test.ts`, `tests/SeniorExperience.test.tsx`, `tests/FamilyDashboard.test.tsx`(신규), `tests/emergencies-route.test.ts`(신규).
- 검증 명령과 결과:
  - `npm test -- --run`: 18 test files, 140 tests 통과(기존 130 + 신규/확장 10 파일 변경으로 순증가 10 — urgency 15→42, SeniorExperience 6→10, FamilyDashboard/emergencies-route 신규 2+4).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공(`/senior` 4.48kB→4.65kB, `/family` 2.23kB→2.4kB).
- 의사결정: 긴급 판단 규칙은 여전히 순수 정규식 기반 fixture이며 실제 `gpt-5.6-terra` Responses 호출로 교체되지 않았다(§14.1 MVP 확정 선택에 따라 실제 API 미호출). PRD §11.1은 "고정 긴급 키워드와 부정 표현 규칙을 먼저 평가하고, 이후 모델이 구조화된 의도·답변을 반환"하는 2단계 구조를 요구하므로, 이 정규식 규칙은 실제 구현에서도 모델 호출 이전 1차 방어선으로 유지되어야 하며 모델 응답으로 대체되는 대상이 아니다. `FamilyDashboard`의 나머지 부분(전체 하드코딩 여부, `WorkerDashboard`와의 실시간 연동)은 Phase 4에서 이미 범위 밖으로 문서화했으므로 이번 Phase에서는 감사 로그 요구사항 충족에 필요한 "확인 완료" 버튼 하나만 최소 수정했다.
- 알려진 제한/다음 단계: 위치 권한(Geolocation) 연동은 여전히 고정 데모 문자열("대전광역시 중구 (데모 위치)")이며 실제 브라우저 Geolocation API 호출·거부/타임아웃 폴백은 구현하지 않았다(PRD §7.1 "현재 위치 권한이 있으면 위치 ... 요약"의 조건부 요구이며, 이번 실행 범위에서 다루지 않은 잔여 항목). `WorkerDashboard`의 긴급 카드(`worker-emergency`)는 여전히 정적 데모 문구이며 실제 `emergency_events`/`GET /api/emergencies`로 연결되지 않았다 — Phase 6 이후 또는 별도 후속 작업 대상. 긴급 화면 자체의 접근성(스크린 리더 `aria-live`, 200% 확대)은 DESIGN.md §7 토큰 위에서 렌더링되지만 별도 접근성 자동 검사는 Phase 8(E2E) 범위다.
- 예정 커밋 메시지: `feat: 사람 확인 기반 긴급 대응 흐름 구현`

## 2026-08-25 12:33 — Phase 6a: 실제 OpenAI 어댑터 도입 (PRD v1.4 §11.5)

- 목표: PRD v1.4 §11.5/TDD §3.3·§3.11의 "자격증명이 있으면 실제 연동이 표준 실행 경로" 정책에 따라, `AiPort`(전사·의도분류·TTS)의 실제 OpenAI 어댑터를 만들고 세 라우트(`/api/ai/transcribe`, `/api/ai/respond`, `/api/ai/speech`)를 fixture 대신 이 포트에 연결한다. 자격증명이 없거나 호출이 실패하면 조용히 mock으로 대체하지 않고 명확한 오류 상태를 반환한다.
- PRD/TDD 근거: PRD §11.1(요청 흐름), §11.2(모델 라우팅), §11.5(신설, 실제 연동 전환 정책), §12(API 계약), FR-04/FR-07, TDD §3.6(아키텍처 경계)·§3.7(음성 답변 계약)·§3.11(외부 API 기본 정책).
- Red:
  1. `tests/ai-port.test.ts` 신설 — `fixtureAi`(transcribe/classifyAndDraft/speech)와 `selectAiPort()`(자격증명 존재 여부로 fixture vs openai 선택하는 단일 결정 지점)가 아직 없어 import 실패로 확인.
  2. `tests/chat-use-case.test.ts`를 비동기 `respondToUtterance`(AiPort 주입 가능)로 갱신 — 기존 동기 함수 시그니처와 충돌해 실패 확인 후 갱신.
  3. `tests/transcribe-route.test.ts` 신설 — 빈/과대/비오디오 MIME 업로드 거부(400/413/415)와 정상 업로드 처리(200)를 검증하는 테스트를 먼저 작성, 기존 라우트가 `POST()`에 파라미터조차 받지 않아 즉시 실패 확인.
- Green:
  - `lib/server/ai.ts`: `AiPort` 인터페이스를 `transcribe(audio, mimeType)`/`classifyAndDraft(input)`/`speech(text)`로 재정의했다. `classifyWithHardEmergencyGate`(=기존 `classifyUrgency`)를 공용 헬퍼로 분리해 fixture와 real 어댑터가 동일하게 "고정 긴급 키워드 규칙을 모델 호출보다 먼저 평가"하도록 강제했다(TDD §3.6). `fixtureAi`는 네트워크 없이 이 구조를 그대로 흉내 낸다.
  - `lib/server/openaiAdapter.ts`(신규): `createOpenAiPort(env)`가 실제 어댑터를 만든다. `transcribe`는 `multipart/form-data`로 `gpt-transcribe`를, `classifyAndDraft`는 (긴급 하드 게이트를 먼저 통과시킨 뒤) Structured Outputs(JSON Schema, `strict: true`)로 `gpt-5.6-terra` Responses API를, `speech`는 `gpt-4o-mini-tts` Speech endpoint를 호출한다. 세 호출 모두 `OPENAI_API_KEY`+`OpenAI-Project` 헤더 하나로 인증하고 `store: false`를 명시한다. 모델이 자체적으로 emergency를 주장해도 하드 게이트를 이미 통과한 뒤이므로 emergency로 재격상하지 않는다(최종 긴급 판정은 규칙 엔진 하나만 담당).
  - `lib/server/aiFactory.ts`(신규): `selectAiPort(env)` — `OPENAI_API_KEY`와 `OPENAI_PROJECT_ID`가 **모두** 있을 때만 real adapter, 하나라도 없으면 fixture. 이 라우트들의 유일한 분기점이다.
  - `lib/server/chatUseCase.ts`: `respondToUtterance(input, ai = fixtureAi)`로 변경, 내부 regex 직접 호출을 제거하고 주입된 `AiPort.classifyAndDraft`에 위임한다.
  - `app/api/ai/respond/route.ts`: `selectAiPort()`로 포트를 고르고 `await respondToUtterance(data, ai)`. 실패 시 502 + "지금은 연결할 수 없어요" 메시지(mock 대체 아님).
  - `app/api/ai/transcribe/route.ts`: 실제 `multipart/form-data` 파싱, 크기(10MB)·MIME(`audio/*`) 검증, 전사 후 오디오 버퍼를 어떤 저장소에도 쓰지 않고 함수 스코프에서 폐기.
  - `app/api/ai/speech/route.ts`: 소유권 검증(`state.turns`에서 `assistant_turn_id`+`senior_id` 매치)은 그대로 유지하고, 실제 합성은 `AiPort.speech`에 위임. 5초 타임아웃(`withTimeout`)을 넘기거나 호출이 실패하면 `speech_status: 'browser_fallback'` JSON으로 폴백, 성공 시 `audio/mpeg` 바이너리 스트림 + `Cache-Control: private, no-store`.
  - `components/SeniorExperience.tsx`: `record()`를 실제 `MediaRecorder`/`getUserMedia` 녹음(4초 캡처 후 자동 정지, PRD 최대 60초 상한 이내) → `FormData` 업로드로 교체했다. 브라우저가 마이크/`MediaRecorder`를 지원하지 않거나 권한이 거부되면 조용히 멈추지 않고 텍스트 입력 폴백 안내로 전환한다.
  - `vitest.config.ts`: `tests/transcribe-route.test.ts`만 `node` 환경으로 실행하도록 `environmentMatchGlobs` 추가 — jsdom의 `Blob`/`FormData`가 undici(Next `NextRequest.formData()`가 내부적으로 쓰는 파서)의 webidl 검사와 호환되지 않아(멀티파트 파싱이 `assert(webidl.is.File(value))`에서 예외) 실제 런타임과 같은 undici 경로로 검증하기 위함(테스트 환경 한정 이슈이며 프로덕션 Node 런타임에는 영향 없음을 별도 `node -e` 스크립트로 직접 확인).
- Refactor: 없음(이번 단위는 포트 재정의와 라우트 배선이 본질이며 별도 구조 정리 대상은 발견하지 못했다).
- 변경 파일: `lib/server/ai.ts`, `lib/server/openaiAdapter.ts`(신규), `lib/server/aiFactory.ts`(신규), `lib/server/chatUseCase.ts`, `app/api/ai/respond/route.ts`, `app/api/ai/transcribe/route.ts`, `app/api/ai/speech/route.ts`, `components/SeniorExperience.tsx`, `vitest.config.ts`, `tests/ai-port.test.ts`(신규), `tests/transcribe-route.test.ts`(신규), `tests/chat-use-case.test.ts`, `scripts/smoke-openai.ts`(신규, §14.2 owner 실행용).
- 검증 명령과 결과:
  - `npm test -- --run`: 20 test files, 151 tests 통과(기존 140 → 151, 신규 ai-port 6 + transcribe-route 5 순증가).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공.
  - **실제 OpenAI smoke test (PRD §14.2, 소유자 승인 하에 이번 세션에서 직접 실행, `npx tsx scripts/smoke-openai.ts`)**: `gpt-5.6-terra`(Responses), `gpt-transcribe`(Transcription), `gpt-4o-mini-tts`(Speech) **3종 모두 실패**. 원인은 코드 결함이 아니라 계정 설정: `OPENAI_API_KEY`/`OPENAI_PROJECT_ID` 인증 자체는 성공(`GET /v1/models` 200 확인)했으나, 이 프로젝트의 모델 허용 목록에 세 모델이 전부 없다(`model_not_found`, "Project ... does not have access to model ..."). `GET /v1/models`로 실제 허용 목록을 직접 조회해 확인한 결과 이 프로젝트는 `gpt-5.6-luna`와 `text-embedding-3-small` 두 모델만 접근 가능하며 `gpt-5.6-terra`/`gpt-transcribe`/`gpt-4o-mini-tts` 중 어느 것도 포함되지 않는다. 이는 PRD §11.2/§14가 미리 경고한 "남은 위험은 키가 아니라 계정 설정(프로젝트 모델 허용 목록)"에 정확히 해당하는 사례다. 값 자체(모델 id 목록 포함)는 개인정보가 아니므로 이 로그에 남기지만 키·토큰 값은 어디에도 출력하지 않았다.
- 의사결정: smoke test 실패에도 불구하고 코드는 "자격증명이 있으면 실제 어댑터를 쓴다"는 PRD §11.5 정책대로 구현을 완료했다 — 이는 결함이 아니라 정확히 의도된 동작이며, 프로젝트 소유자가 OpenAI 대시보드에서 `gpt-5.6-terra`/`gpt-transcribe`/`gpt-4o-mini-tts` 모델 접근 권한을 프로젝트에 추가(또는 `OPENAI_TEXT_MODEL`/`OPENAI_TRANSCRIBE_MODEL`/`OPENAI_TTS_MODEL`을 실제 허용된 모델로 임시 조정)하는 즉시 코드 변경 없이 정상 동작한다. 긴급 하드 게이트(`classifyWithHardEmergencyGate`)는 모델 호출 실패와 무관하게 항상 먼저 평가되므로, 이 실패가 긴급 감지 안전성에는 영향을 주지 않는다.
- 알려진 제한/다음 단계: §14 표의 OpenAI 세 행 판정은 `조건부·미검증`에서 **`조건부·실행 확인 시도함·실패(계정 모델 권한)`**로 갱신되어야 한다(문서 갱신은 소유자가 실제 계정 설정을 바꾼 뒤 재실행하는 다음 smoke test 결과를 기다린다). `SpeechControls.tsx`는 여전히 브라우저 `speechSynthesis`만 호출하며 `/api/ai/speech`를 실제로 소비하지 않는다 — 서버 TTS 배선은 이번 단위에서 API 라우트까지만 완료했고, 클라이언트 재생 연결은 다음 단위(우선순위 3 이후) 과제로 남는다. `scripts/smoke-openai.ts`는 owner가 필요할 때 재실행할 수 있도록 저장소에 남긴다(실행 자체가 비용을 발생시키므로 CI에 자동 연결하지 않는다).
- 예정 커밋 메시지: `feat: 실제 OpenAI 전사·의도분류·TTS 어댑터 도입`

## 2026-08-25 12:39 — Phase 6b: Supabase Postgres 요청 카드 저장소 어댑터

- 목표: PRD v1.4 §11.5/§12·§13에 따라 `ServiceRequestRepository` 포트의 Supabase Postgres 운영 구현을 추가하고, Supabase 세 환경변수 존재 여부로 in-memory/Supabase를 고르는 단일 결정 지점을 만든다. Supabase 프로젝트 키가 아직 없으므로(owner가 추후 추가 예정) 이번 단위는 코드 완성까지만 하고 실제 프로젝트 대상 smoke test는 하지 않는다(§14.2 "Supabase는 프로젝트 키가 설정된 뒤 실행한다").
- PRD/TDD 근거: PRD §7.4(카드 모델)·§11.4(실시간 동기화 구조)·§11.5(신설, 실제 연동 전환 정책)·§13(데이터 모델), TDD §3.6(포트/어댑터 경계)·§3.9(실시간 계약)·§3.11.
- Red:
  1. `tests/supabase-service-request-repository.test.ts` 신설 — `mapRowToServiceRequest`(Postgres snake_case row → 도메인 camelCase), `mapCreateInputToRow`(역방향), `SupabaseServiceRequestRepository`(fake Supabase client 주입) 세 대상이 아직 없어 import 실패로 Red 확인.
  2. `ServiceRequestRepository` 인터페이스를 동기(`ServiceRequest[]` 등 직접 반환)에서 `Promise<...>` 반환으로 바꾸면서 기존 `tests/consent-and-repository.test.ts`의 동기 호출 12곳이 타입 불일치로 실패하는 것을 typecheck로 먼저 확인한 뒤 `await`/`async`로 갱신했다(Supabase 어댑터는 본질적으로 비동기이므로 포트 계약 자체를 바꾸는 것이 올바른 방향이라고 판단).
- Green:
  - `lib/server/serviceRequestRepository.ts`: `ServiceRequestRepository`의 8개 메서드 시그니처를 모두 `Promise<T>` 반환으로 변경. `InMemoryServiceRequestRepository`는 각 메서드를 `async`로 감싸 동일 인터페이스를 만족하되 실제로는 여전히 동기적으로 즉시 resolve된다(테스트는 네트워크 없이 그대로 빠르게 통과).
  - `lib/server/supabaseServiceRequestRepository.ts`(신규): `mapRowToServiceRequest`/`mapCreateInputToRow` 순수 매핑 함수와 `SupabaseServiceRequestRepository` 클래스. `create()`는 애플리케이션에서 먼저 idempotency를 확인하지 않고 DB의 `unique (senior_id, idempotency_key)` 제약(0001_demo_schema.sql)에 위임하며, Postgres unique_violation(`23505`)을 받으면 기존 행을 재조회해 반환한다(동시 재전송에도 안전). `transition`/`acknowledge`/`cancel`은 먼저 `get()`으로 현재 상태를 읽어 `canTransitionRequest`/`canCancelRequest`(lib/domain/policies.ts)로 서버 측 권한/전이 재검증을 한 뒤에만 UPDATE한다 — RLS는 행 접근을, 애플리케이션 정책은 상태 전이 규칙을 이중으로 강제한다(TDD §3.8 "허용되지 않은 전이는 서버가 거부").
  - `lib/server/serviceRequestRepositoryFactory.ts`(신규): `selectServiceRequestRepository(env, seed)` — `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SECRET_KEY`가 **모두** 있을 때만 `createClient` + `SupabaseServiceRequestRepository`, 하나라도 없으면 `InMemoryServiceRequestRepository`. `SUPABASE_SECRET_KEY`(RLS 우회)를 쓰는 이유와, 실제 Supabase Auth 연동 후 사용자 JWT+RLS로 전환해야 한다는 잔여 과제를 주석으로 명시했다.
  - `lib/server/store.ts`: 하드코딩된 `new InMemoryServiceRequestRepository()`를 `selectServiceRequestRepository()` 호출로 교체하고 `serviceRequestsProvider`를 함께 export했다. 데모 시드 카드는 `provider === 'in-memory'`일 때만 생성한다 — 실제 Supabase 프로젝트에 코드가 스스로 데모 행을 INSERT하지 않는다(§11.5 "코드가 스스로 스키마를 변경하지 않는다" 원칙의 연장으로, 데이터 시딩도 동일하게 취급).
  - `app/api/service-requests/route.ts`, `app/api/service-requests/[id]/route.ts`: 저장소 호출 4곳을 `await`로 변경.
- Refactor: 없음(포트 계약을 async로 바꾸는 것 자체가 이번 단위의 본질적 변경이며, 이후 별도 정리 대상은 발견하지 못했다).
- 변경 파일: `lib/server/serviceRequestRepository.ts`, `lib/server/supabaseServiceRequestRepository.ts`(신규), `lib/server/serviceRequestRepositoryFactory.ts`(신규), `lib/server/store.ts`, `app/api/service-requests/route.ts`, `app/api/service-requests/[id]/route.ts`, `tests/supabase-service-request-repository.test.ts`(신규), `tests/consent-and-repository.test.ts`.
- 검증 명령과 결과:
  - `npm test -- --run`: 21 test files, 155 tests 통과(기존 151 → 155, 신규 supabase-service-request-repository 4).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공.
  - Supabase 실제 프로젝트 대상 smoke test: **미실행.** `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY`가 `.env`에 아직 없다(owner가 추후 추가 예정, 이번 세션 범위 밖). §14.2 6번 "Supabase는 프로젝트 키가 설정된 뒤 실행한다"에 따라 정상적인 보류 상태다.
- 의사결정: 새 migration 파일(`0002_*.sql`)은 이번 단위에서 만들지 않았다 — `0001_demo_schema.sql`의 `service_requests` 테이블·RLS 정책이 이 어댑터의 컬럼명(snake_case)·상태값과 정확히 일치하는 것을 코드 작성 중 재확인했고, 어댑터 구현 과정에서 스키마 조정이 필요한 결함을 발견하지 못했기 때문이다. 실제 Supabase 프로젝트에 연결해 smoke test를 실행하면서 스키마 불일치가 발견되면 그때 `0002_*.sql`을 추가한다. Realtime(`RealtimePort`)의 Supabase `postgres_changes` 어댑터는 이번 단위에서 다루지 않았다 — 저장소가 로컬 `onChange` 리스너로 발행하는 이벤트는 여전히 프로세스 내부에서만 전파되며, 여러 서버 인스턴스/실제 브라우저 클라이언트에 걸친 전파는 클라이언트가 여전히 `PollingRealtimeClient`(3초 폴링, `GET /api/service-requests` 재조회)로 대신한다 — 이는 실제 Supabase Postgres가 정본이 된 이후에도 여전히 "복지사와 부양가족이 동시에 같은 데이터를 본다"는 요구를 충족한다(폴링 대상이 이제 실제 공유 DB이므로).
- 알려진 제한/다음 단계: `selectServiceRequestRepository`가 매 모듈 로드마다 `createClient`를 호출하는 경량 클라이언트 생성 방식이라 서버리스/엣지 런타임에서도 안전하지만, 커넥션 풀링·재시도 정책은 Supabase 클라이언트 기본값을 그대로 따른다(별도 튜닝 없음). `FamilyDashboard.tsx`가 여전히 `/api/service-requests`를 전혀 호출하지 않고 완전히 하드코딩된 배열을 렌더링하는 문제는 이번 단위에서 다루지 않았다 — 우선순위 3(다음 단위)에서 처리한다.
- 예정 커밋 메시지: `feat: Supabase Postgres 요청 카드 저장소 어댑터 도입`

## 2026-08-25 12:43 — Phase 6c: FamilyDashboard를 실제 요청 카드 API에 연결

- 목표: 사용자 지시("목데이터 금지")에 따라 `FamilyDashboard.tsx`가 여전히 완전히 하드코딩된 배열(요청 1건/위기 알림 1건/미처리 1건, 고정 AI 요약 문구)을 렌더링하던 것을 실제 `GET /api/service-requests` 응답으로 교체한다. `WorkerDashboard`/`SeniorExperience`는 이미 Phase 4에서 실 API에 연결되어 있었고 가족 화면만 예외로 남아 있었다.
- PRD/TDD 근거: PRD §7.2(부양가족 화면 정보 요구사항 — "AI가 만든 요약에는 반드시 'AI 요약' 표시와 원본 기록 링크", "수집되지 않은 정보는 정상으로 추정하지 않고 '확인되지 않음'으로 표시")·§7.4(가족은 `transcript` 없이 `summary`+상태만), TDD §3.8(카드 렌더링은 세 화면이 하나의 컴포넌트 재사용 원칙 — 이번 단위는 컴포넌트 통합까지는 하지 않고 데이터 소스만 실 API로 교체했다. 컴포넌트 자체 통합은 별도 리팩터 대상으로 남겨둔다).
- Red:
  1. `tests/FamilyDashboard.test.tsx`에 새 describe 블록 추가 — `GET /api/service-requests`를 스텁하고 렌더 후 "이번 주 요청" AI 요약이 실제 카드의 `summary`를 반영하는지 검증. 기존 컴포넌트는 이 fetch를 전혀 호출하지 않으므로 `fetchMock`이 `/api/service-requests`로 불리지 않아 Red 확인. 두 번째 테스트는 가족 화면이 카드의 `transcript`를 렌더링하지 않는지 확인(서버가 이미 redact하지만 클라이언트도 원문이 있다고 가정하지 않아야 함).
- Green:
  - `components/FamilyDashboard.tsx`: `fetchFamilyRequests()`(GET `/api/service-requests`, `body.data` 배열만 사용하고 `transcript` 필드는 애초에 참조하지 않음), `useFamilyRealtime()`(`PollingRealtimeClient`, Worker/Senior와 동일 패턴), `useServiceRequestList` 훅으로 실 데이터를 가져온다. "최근 7일 변화" 카드는 `createdAt` 기준 7일 이내 카드 수(`weekly.total`)와 `new`/`in_progress` 상태 카드 수(`weekly.unresolved`)를 실제로 계산한다. AI 요약 문구는 최신 카드의 실제 `summary`를 반영하고, 카드가 없으면 "이번 주에 등록된 요청이 없어요"로 정직하게 표시한다("확인되지 않음" 원칙, PRD §7.2). "위기 알림" 카운트는 이번 단위 범위 밖(`emergency_events` API 연동은 별도 과제)이라 기존 고정값 "1건"을 그대로 두었다 — 이는 실제 emergencies 시드 데이터와 일치하는 값이라 거짓 표시는 아니지만, 실 API 연동은 아니므로 "알려진 제한"에 명시한다.
- Refactor: 없음.
- 변경 파일: `components/FamilyDashboard.tsx`, `tests/FamilyDashboard.test.tsx`.
- 검증 명령과 결과:
  - `npm test -- --run`: 21 test files, 157 tests 통과(기존 155 → 157, FamilyDashboard 2→4).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 18개 라우트 모두 생성 성공(`/family` 2.4kB → 3.52kB, 실 API 연동 코드 증가분).
- 의사결정: `FamilyDashboard`의 "위기 알림" 섹션(상단 배너, 위기 상세 화면)은 여전히 고정 데모 문구를 쓴다 — 이번 사용자 지시는 명시적으로 "노인 요청 사항을 카드 형태로 저장/조회"하는 파이프라인(우선순위 1~3)에 관한 것이었고, `emergency_events`를 가족 화면이 실제 조회하도록 만드는 것은 별도 범위(TDD Phase 5는 이미 완료됐으나 그 완료 기준은 "PATCH로 감사 로그를 남기는 것"이었지 "가족 화면이 GET으로 실제 목록을 읽는 것"은 아니었다)로 문서화해 두고 이번 단위에서는 손대지 않았다.
- 알려진 제한/다음 단계: `FamilyDashboard`의 위기 알림 배너/상세는 여전히 고정 데모 문구(`emergency_events`를 실제로 GET하지 않음) — 다음 단위 후보. 세 역할 화면이 "하나의 요청 카드 컴포넌트"를 공유하도록 리팩터하는 TDD §3.8 완료 조건은 아직 충족되지 않았다(`WorkerDashboard`/`SeniorExperience`/`FamilyDashboard`가 각자 카드 렌더링 JSX를 따로 가지고 있음) — 기능적으로는 세 화면 모두 실 데이터를 쓰지만 구조적 중복 제거는 별도 리팩터 과제로 남는다.
- 예정 커밋 메시지: `feat: FamilyDashboard를 실제 요청 카드 API에 연결`

## 2026-08-25 — OpenAI 재smoke test: 계정 모델 권한 해금 확인 + 실전사 빈 문자열 오분류 버그 수정

- 목표: 소유자가 OpenAI 프로젝트의 모델 허용 목록을 갱신했다고 알려와, PRD §14.2 smoke test(`npx tsx scripts/smoke-openai.ts`)를 다시 실행해 `조건부·미검증`을 `실행 확인`으로 승격할 수 있는지 확인한다.
- PRD 요구사항: §11.5(v1.4 실제 연동 전환 정책), §14.2(출시 직전 실행 확인 체크), §14 표(OpenAI 세 행 판정 갱신).
- Red: 재실행 결과 `responses: pass, transcription: fail, speech: pass`(1차), 이후 재시도에서 `speech`도 간헐적으로 fail — 값을 직접 출력하지 않는 원시 `fetch` 프로브로 `/v1/audio/speech`·`/v1/responses`·`/v1/audio/transcriptions` 세 엔드포인트를 각각 재현했다. Responses/Speech는 반복 호출 시 403(`model_not_found`)에서 200으로 안정화되는 것을 관찰했다 — 프로젝트 모델 권한 변경이 OpenAI 쪽에서 전파되는 도중이었다(코드 문제 아님, 계정 설정 전파 지연). Transcription만 재현 시 계속 `400 invalid_value "Audio file might be corrupted or unsupported"`로 실패 — 이는 권한 문제가 아니라 `scripts/smoke-openai.ts`의 기존 fixture가 `data` 청크 길이 0인 사실상 빈 WAV였기 때문. 유효한 0.5초 무음 WAV(`data` 청크에 실제 무음 PCM 샘플 포함)로 원시 호출하면 200과 `{"text":""}`을 반환함을 확인했다. 이 시점에 어댑터를 직접 호출(`createOpenAiPort().transcribe(...)`)해보니 `transcription_empty` 예외가 던져지는 실제 버그를 발견했다 — `lib/server/openaiAdapter.ts`의 `if (!data.text) throw new Error('transcription_empty')`가 무음 오디오의 정상 응답인 빈 문자열(`""`)을 falsy로 오판해 실패로 취급하고 있었다.
- Green: `openaiAdapter.ts`의 검사를 `if (!data.text)` → `if (typeof data.text !== 'string')`로 변경해, API가 실제로 응답 필드를 빠뜨리거나 malformed할 때만 예외를 던지고 정상적인 빈 문자열 전사는 통과시키도록 수정했다. 이 검사를 참조하는 기존 테스트는 없어 회귀 없이 수정 가능했다.
- Refactor: `scripts/smoke-openai.ts`의 무효 WAV fixture도 함께 교체했다 — 44바이트 빈 헤더 대신 0.5초 분량의 실제 무음 PCM 데이터를 담은 유효한 WAV를 생성해 보내도록 해, 앞으로 이 스크립트가 "권한 없음"과 "잘못된 테스트 fixture"를 혼동해 보고하지 않게 했다.
- 변경 파일: `lib/server/openaiAdapter.ts`, `scripts/smoke-openai.ts`.
- 검증 명령과 결과:
  - `npx tsx scripts/smoke-openai.ts`: 수정 후 3회 연속 `{"responses":"pass","transcription":"pass","speech":"pass"}`, exit 0으로 안정적으로 통과. **PRD §14 표의 OpenAI 세 행은 이 시점부로 `조건부·미검증`에서 `실행 확인`으로 승격한다** (표 문구 자체는 다음 PRD 편집에서 갱신 예정).
  - `npm test -- --run`: 21 test files, 157 tests 통과(회귀 없음).
  - `npm run typecheck`: 오류 없음.
  - `npm run lint`: 오류 없음.
  - `npm run build`: 전 라우트 생성 성공.
- 의사결정: 이번 발견은 두 가지가 섞여 있었다는 점을 분명히 남긴다 — (1) 계정 모델 권한은 소유자의 변경 이후 실제로 해금되었으나 OpenAI 쪽 전파 지연으로 초기 재시도가 flaky하게 실패했다(코드가 손댈 수 없는 외부 요인), (2) 그와 별개로 `openaiAdapter.ts`에는 무음/짧은 오디오의 정상 빈 응답을 오류로 오분류하는 실제 버그가 있었다(코드 결함, 이번에 수정). 두 원인을 구분하지 않았다면 "권한이 아직도 없다"고 잘못 결론 내릴 뻔했다.
- 알려진 제한/다음 단계: 실제 사용자 음성(무음이 아닌)에 대한 전사 정확도는 여전히 검증하지 않았다 — smoke test는 연결·권한만 확인한다. `SpeechControls.tsx`가 `/api/ai/speech`를 실제로 소비하도록 클라이언트 재생 배선은 여전히 다음 과제로 남아 있다.
- 예정 커밋 메시지: `fix: OpenAI 전사 어댑터의 빈 응답 오분류 수정`
