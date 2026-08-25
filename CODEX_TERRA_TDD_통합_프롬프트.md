# 돌봄이음 AI — Codex Terra TDD 통합 개발 프롬프트

> 기준 문서: `PRD_돌봄이음_AI.md` v1.4, `DESIGN.md`  
> 개발 에이전트: Codex의 GPT-5.6 Terra  
> 목적: PRD를 단계별 TDD로 구현하고, 검증된 단위로 커밋·개발 로그·GitHub push까지 수행  
> 기본 안전 조건: 실제 `.env` 값 출력 금지, 실제 개인정보 사용 금지  
> **v1.4부터 외부 API 정책 변경:** PRD §11.5의 조건(자격증명 존재 + 소유자 승인)이 성립하면 실제 OpenAI/Supabase 호출이 **표준 실행 경로**다. 아래 §1 시작 명령과 §2의 "승인 전 mock만" 문구는 Phase 0~5(승인 전 기록)의 이력이며, Phase 6 이후에는 PRD §11.5를 따른다. GitHub push 승인 요건은 그대로 유지된다 — 실제 API 호출 승인과 push 승인은 별개다.

---

## 1. 사용하는 방법

Codex Terra에게 저장소 루트에서 이 파일과 `PRD_돌봄이음_AI.md`를 함께 읽게 한 뒤 아래 시작 명령을 전달한다.

```text
CODEX_TERRA_TDD_통합_프롬프트.md와 PRD_돌봄이음_AI.md를 처음부터 끝까지 읽어라.
통합 프롬프트의 공통 규칙을 유지한 채 Phase 0부터 시작하라.
이번 실행에서는 실제 외부 API를 호출하지 말고 mock/fixture만 사용하라.
각 Phase는 Red → Green → Refactor와 품질 게이트를 통과한 뒤 커밋하라.
GitHub push는 원격 저장소와 권한을 확인하고, 최초 push 전에 내 허가를 받아라.
```

한 번에 모든 기능을 요구하지 않는다. 각 Phase 완료 보고를 확인한 뒤 다음 Phase를 실행한다. `전체 완료까지 계속`을 명시한 경우에도 테스트 실패, 비밀정보 위험, 원격 저장소 부재, 실제 외부 쓰기 승인 필요 상태에서는 안전 경계를 지킨다.

---

## 2. 내가 먼저 할 일

아래 항목은 프로젝트 소유자가 직접 준비한다. 비밀 값은 채팅이나 커밋에 붙여 넣지 않는다.

- [ ] OpenAI Platform에서 해당 프로젝트의 결제/사용 한도와 `gpt-5.6-terra`, `gpt-transcribe`, `gpt-4o-mini-tts` 사용 허용 여부를 확인한다. 세 모델 모두 `OPENAI_API_KEY` 하나로 호출하므로 추가 키는 필요 없지만, 그 키가 restricted 스코프로 발급되어 Responses·Transcription·Speech 중 일부 권한이 빠지지 않았는지 함께 확인한다.
- [ ] Supabase 프로젝트를 만들고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`를 로컬 비밀 환경에 설정한다.
- [ ] 공공데이터포털에서 국립중앙의료원·충청남도 API 활용신청을 하고 `DATA_GO_KR_SERVICE_KEY`를 로컬 비밀 환경에 설정한다.
- [ ] Kakao Local을 선택 기능으로 시연할 경우에만 `KAKAO_REST_API_KEY`를 설정한다.
- [ ] GitHub에 빈 원격 저장소를 만들고 HTTPS 또는 SSH 원격 URL과 push 권한을 준비한다.
- [ ] 실제 외부 smoke test를 실행할 시점에 별도로 승인한다. 승인 전 테스트는 mock/fixture만 사용한다.
- [ ] 데모에서 실제 노인 정보, 실제 건강정보, 실제 가족관계증명서·위임장을 사용하지 않고 합성 데이터만 쓴다.
- [ ] 119 전화/문자는 발신 직전 화면까지만 시연하고 실제 발신하지 않는다.

현재 저장소에서 이미 관찰된 상태는 다음과 같다.

- 브랜치는 `main`이지만 아직 커밋이 없다.
- Git 원격 저장소가 설정되어 있지 않다.
- `.env`가 untracked 상태이므로 첫 stage 전에 반드시 ignore 규칙을 만든다.
- `index.html`은 기존 목업이므로 시각·문구 참고자료로 보존한다.
- 기존 파일이 모두 사용자 작업일 수 있으므로 임의 삭제, 덮어쓰기, 이동을 하지 않는다.

---

## 3. Codex Terra에 내리는 통합 명령

아래부터는 개발 에이전트가 반드시 따라야 하는 실행 계약이다.

### 3.1 역할과 목표

너는 돌봄이음 AI의 주 개발자다. `PRD_돌봄이음_AI.md` v1.3를 제품 요구사항의 단일 기준으로 사용한다. Next.js App Router + TypeScript + Supabase 구조로 3일 MVP를 구현하되, 테스트가 설계를 이끌도록 한다.

최우선 결과는 다음 두 수직 흐름이다.

1. 노인의 병원동행 요청 → 의도 구조화 → **요청 카드 초안** → 본인 확인 → 사회복지사 업무함에 즉시 반영 → 가족 상태 공유
2. 긴급 발화 → 고정 규칙 + 모델 분류 → 119 화면 → 가족/사회복지사 알림 → 처리 상태 공유

노인의 입력이 음성과 텍스트 중 무엇이든 모든 챗봇 답변은 화면 텍스트와 음성을 함께 제공해야 한다.

**요청 카드가 이 제품의 중심 객체다.** 노인의 요청은 자유 대화 로그가 아니라 PRD §7.4가 정의한 카드 한 장으로 저장되고, 세 역할 화면이 같은 카드 모델을 권한에 맞게 다르게 렌더링한다. 역할마다 다른 데이터 구조를 만들지 않는다.

**시각 규칙은 `DESIGN.md`가 단일 기준이다.** 색·간격·글자 크기·라운딩은 `DESIGN.md`의 토큰으로만 지정하고, 컴포넌트에 임의값을 직접 쓰지 않는다. `.dc.html` 목업과 `index.html`은 문구·정보 구조 참고자료이며, 인라인 스타일을 그대로 복사하지 않는다. PRD와 `DESIGN.md`가 충돌하면 정보 요구사항은 PRD, 시각 표현은 `DESIGN.md`를 따른다.

**음식 사진 분석은 v1.2에서 제거된 기능이다.** 노인 화면에 카메라·이미지 업로드 UI를 만들지 않고, `/api/ai/food`나 vision adapter를 만들지 않으며, OpenAI 요청에 이미지 파트를 넣는 코드 경로 자체를 만들지 않는다. 이미지 처리는 Phase 7의 권한 문서 업로드(PDF/JPEG/PNG를 비공개 Storage에 보관, AI 전송 금지)에만 존재한다.

### 3.2 작업 시작 시 필수 조사

1. 저장소의 `AGENTS.md`와 중첩 지침을 찾고 모두 적용한다.
2. `git status --short`, 현재 브랜치, 원격, 최근 로그를 확인한다.
3. 기존 파일과 사용자 변경을 목록화하고 보존한다.
4. `.env`는 내용이나 길이, 접두사, 일부 값도 출력하지 않는다. 필요한 경우 환경변수 **이름의 존재 여부만** `<SET>`/`<MISSING>`으로 보고한다.
5. `index.html`을 기존 UX 참고자료로 읽되 삭제하거나 덮어쓰지 않는다.
6. PRD와 이 통합 프롬프트 사이에 충돌이 있으면 사용자 안전·개인정보·명시적 승인 경계를 우선하고 충돌을 보고한다.

### 3.3 자율성과 승인 경계

- 저장소 읽기, in-scope 코드/테스트/문서 편집, 로컬 mock 테스트, 타입 검사, lint, build는 별도 질문 없이 수행한다.
- 패키지 설치처럼 네트워크와 lockfile 변경이 필요한 정상 구현 작업은 도구의 승인 절차를 따른다.
- **v1.4부터 실제 OpenAI API 호출은 PRD §11.5 조건(자격증명 존재 + 소유자 승인)이 성립하면 승인된 것으로 본다.** 단위/컴포넌트 테스트는 여전히 fixture adapter를 쓰고, 실제 호출은 운영 코드 경로와 명시적 smoke test에서만 수행한다.
- 실제 Supabase 원격 migration **적용**(`supabase db push` 등 스키마 변경 실행)은 소유자가 직접 하거나 별도로 명시 승인한 경우에만 한다. migration SQL 파일을 작성·커밋하는 것은 이 제한과 무관하게 통상 작업이다.
- GitHub push, 배포, 외부 메시지, (OpenAI/Supabase 외의) 비용 발생 작업은 명시적 승인 전 실행하지 않는다.
- 첫 GitHub push 전에 한 번 승인받는다. 같은 실행에서 동일 원격·브랜치로 이어지는 후속 push는 사용자가 연속 push를 허가한 경우에만 계속한다.
- 원격 URL이 없으면 추측하지 말고 사용자에게 정확한 `git remote add origin <URL>` 준비가 필요하다고 보고한다.
- 실제 개인정보, 주민등록번호, 건강 기록, 권한 증빙을 만들거나 외부 서비스로 보내지 않는다.
- `.env`, 키, 토큰, 쿠키, signed URL을 로그·테스트 snapshot·에러 메시지·커밋에 남기지 않는다.
- 파괴적 Git 명령, 강제 push, `git reset --hard`, 사용자 변경 폐기, commit amend는 명시적 요청 없이는 금지한다.

### 3.4 비밀정보와 Git 사전 안전장치

첫 커밋보다 먼저 `.gitignore`에 최소한 아래 의미의 규칙을 적용한다.

```gitignore
.env*
!.env.example
node_modules/
.next/
coverage/
playwright-report/
test-results/
```

규칙은 기존 `.gitignore`가 있으면 병합한다. `.env.example`에는 변수명, 빈 값, 설명만 허용하며 실제 값·실제 ID를 넣지 않는다.

stage 전후에 다음을 확인한다.

1. `git status --short`
2. stage는 파일 allowlist로 수행하고 첫 검토 전 `git add .`를 쓰지 않는다.
3. `git diff --cached --name-only`에 `.env` 또는 생성물·테스트 리포트가 없는지 확인한다.
4. staged diff에서 일반적인 비밀 패턴과 예상치 못한 대용량/바이너리를 검사한다. 검사 결과에도 비밀 값을 출력하지 않는다.
5. 이상이 있으면 commit/push를 중단하고 안전하게 unstage한 뒤 원인을 보고한다.

### 3.5 고정 기술 방향

- Next.js App Router, React, TypeScript, 모바일 우선 UI
- Supabase Auth, Postgres, RLS, Realtime, Private Storage
- OpenAI Responses API: `OPENAI_TEXT_MODEL` 기본 `gpt-5.6-terra`
- 음성 전사: `OPENAI_TRANSCRIBE_MODEL` 기본 `gpt-transcribe`
- 음성 합성: `OPENAI_TTS_MODEL` 기본 `gpt-4o-mini-tts`
- Realtime 음성: `OPENAI_REALTIME_MODEL` 기본 `gpt-realtime-2.1-mini`, 단 P2 기능 플래그로 격리하며 MVP에서는 사용하지 않는다
- **AI 자격증명은 `OPENAI_API_KEY`와 `OPENAI_PROJECT_ID` 두 개뿐이다.** 위 세 엔드포인트는 모두 이 키 하나로 인증하고, 모델은 요청마다 `model` 필드로 지정한다. 엔드포인트별로 다른 키 이름을 새로 만들거나 `OPENAI_API_KEY_TTS` 같은 변수를 추가하지 않는다. `OPENAI_PROJECT_ID`는 `OpenAI-Project` 헤더(SDK의 `project` 옵션)로만 전달한다.
- `.env.example`에 남아 있는 단일 `OPENAI_MODEL` 변수는 위 용도별 모델 변수와 충돌하므로 제거하고 이 이름 체계로 교체한다. `.env.example`에는 변수명·빈 값·설명만 남기고 실제 키와 실제 프로젝트 ID를 넣지 않는다.
- AI 이외 연동(Supabase, 공공데이터포털, Kakao)은 각각 별도 키 체계이므로 위 두 변수로 통합하지 않는다.
- 단위/컴포넌트 테스트: Vitest + React Testing Library
- HTTP mock/계약 테스트: MSW 또는 동일 목적의 명시적 adapter fake
- E2E: Playwright
- 런타임 입력 검증: Zod 또는 동등한 schema validation

더 적합한 기존 스택이 이미 있으면 이유와 호환성을 확인한 뒤 기존 선택을 보존한다. 라이브러리를 추가할 때는 꼭 필요한 최소 의존성만 설치한다.

### 3.6 아키텍처 경계

다음 경계를 코드 구조와 테스트에서 분명히 유지한다.

```text
UI/Route
  -> application use case
    -> domain policy (urgency, consent, permission, confirmation)
      -> ports/interfaces
        -> Supabase/OpenAI/Public API adapters
```

- UI와 domain test가 실제 OpenAI/Supabase에 직접 의존하지 않게 한다.
- 외부 제공자별 adapter 앞에 interface를 두고 in-memory fake와 fixture adapter를 제공한다.
- OpenAI model ID는 중앙 설정 한 곳에서만 읽는다.
- 고위험 판단은 모델만 믿지 않고 고정 키워드/부정 표현 규칙, 사용자 확인, 서버 권한 검증을 결합한다.
- 모델은 임의 URL이나 SQL을 실행하지 못하며 명시적 allowlist 함수만 요청할 수 있다.
- 응답 저장은 `store: false`가 기본이며 식별정보를 제거한다.
- 법적 문서 원본은 OpenAI/OCR adapter로 전달하는 타입 경로 자체를 만들지 않는다.
- 애플리케이션이 동작하는 데 secret/service-role 키가 불필요한 일반 요청은 사용자 JWT + RLS로 처리한다.

### 3.7 음성 답변 계약

모든 노인용 assistant turn은 아래 상태를 가진다.

```ts
type SpeechStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'browser_fallback'
  | 'unavailable'
  | 'error'
```

- `assistant_text`를 먼저 확정해 화면에 표시한다.
- `/api/ai/speech`는 임의 텍스트가 아니라 권한이 검증된 `assistant_turn_id`를 받는다.
- 새 답변 재생이나 사용자 녹음 시작 시 기존 재생을 취소한다.
- 서버 TTS가 5초 안에 시작하지 않으면 브라우저 `speechSynthesis`를 1회 시도한다.
- 두 TTS가 모두 실패해도 텍스트, 다시 시도, 긴급 버튼은 유지한다.
- `다시 듣기`, `일시정지/계속`, `그만 듣기`, `음성 답변 끄기`를 구현한다.
- 긴급 핵심 문구는 네트워크와 모델에 의존하지 않는 고정 텍스트/로컬 자산으로 제공한다.
- 최초 사용 시 AI 생성 음성임을 알린다.

### 3.8 요청 카드 계약

PRD §7.4가 정본이다. 구현은 아래를 반드시 만족한다.

```ts
type RequestStatus = 'draft' | 'new' | 'in_progress' | 'done' | 'rejected'
```

- `draft`는 **클라이언트 전용 상태**다. 서버에 저장하지 않고 다른 역할의 화면에 절대 노출되지 않는다.
- 노인의 명시적 확인이 있어야 `new` 카드가 생성된다. 생성 요청은 idempotency key를 받고 같은 키의 재전송은 새 카드를 만들지 않는다.
- 상태 전이는 `draft → new → in_progress → done | rejected`만 허용한다. 노인은 `new`까지만 취소할 수 있다. 허용되지 않은 전이는 **서버가** 거부하고 감사 로그를 남긴다. UI에서 버튼을 숨기는 것으로 권한 통제를 대신하지 않는다.
- 음성 입력과 텍스트 입력은 같은 use case를 통과해 동일 구조의 카드를 만든다. `input_type`만 다르다.
- `summary`는 AI 생성이므로 화면에 `AI` 표시가 붙는다. `transcript`(원문)는 노인 본인과 담당 복지사에게만 보이며, 가족에게는 별도 동의 없이 노출하지 않는다.
- 같은 `status`를 역할별로 다른 문구로 표시한다(PRD §7.4 매핑표). 노인 화면에 행정 용어와 내부 메모를 노출하지 않는다.
- 카드 렌더링은 세 화면이 **하나의 컴포넌트**를 재사용하고, 밀도와 행동 버튼만 다르게 한다.

### 3.9 실시간 동기화 계약

- **실시간은 최적화이고 정본은 서버 조회다.** 실시간 계층을 완전히 꺼도 새로고침하면 같은 카드가 조회되어야 한다.
- 화면 진입 시 목록을 한 번 조회해 초기 상태를 만들고 그 뒤 구독을 연다.
- 클라이언트는 카드를 `id` 기준 map으로 관리하고 이벤트를 upsert로 처리한다. 중복 이벤트가 목록을 늘리지 않고, `updated_at`이 더 오래된 이벤트는 무시한다.
- 구독 단위는 담당 관계다. 전체 테이블을 구독해 클라이언트에서 거르지 않는다. 전달 범위는 RLS로 강제하고 사용자 JWT로 구독한다. 서버 secret 키로 브로드캐스트하지 않는다.
- 연결이 끊겨도 화면을 비우지 않는다. 마지막 목록을 유지하고 연결 상태를 표시하며 재연결한다. 재연결 후 누락 구간은 서버 재조회로 메운다.
- Realtime adapter 뒤에 interface를 두고 in-memory fake를 제공한다. 단위·컴포넌트 테스트가 실제 Supabase Realtime 연결에 의존하지 않아야 한다.

### 3.10 민감문서 저장 계약

- 외부 증빙: Supabase Private Storage의 원본 파일 + Postgres 메타데이터/해시
- 앱 내부 동의: 구조화된 append-only 동의 레코드 + 버전 고정 PDF 증적
- DB의 Base64/`bytea` 문서 저장 금지
- 버킷 공개 전환 금지
- object path에 이름·전화·주민번호 금지
- PDF/JPEG/PNG만, 파일당 5MB, MIME + magic bytes + 크기 검증
- 합성 문서만 사용하며 실제 가족관계증명서·위임장 업로드 UI는 데모 배지와 함께 mock 처리
- 민감 원본은 매 요청 권한을 재검증하는 인증 다운로드 프록시가 기본
- signed URL이 불가피한 미리보기만 60초 이하로 발급하고 URL 로그 금지. 발급 후 만료 전 즉시 취소할 수 없다는 잔여 위험을 테스트/문서화
- 동의 철회 즉시 RLS 접근 차단
- 문서가 `업로드됨`인지 `기관 검토 완료`인지 분리 표시

### 3.11 외부 API 기본 정책

PRD §11.5가 정본이다. Phase 0~5(v1.3 이전)는 실제 외부 호출 없이 진행했고, **Phase 6부터는 아래 정책을 따른다.**

- OpenAI(Responses/Transcription/Speech)와 Supabase(Postgres/Realtime)는 자격증명이 설정되어 있으면 **운영 코드 경로에서 실제로 호출**한다. 조용히 mock으로 대체하지 않는다.
- unit/integration test는 여전히 mock과 버전 관리된 합성 fixture를 사용한다. 포트/어댑터 경계 덕분에 테스트는 실제 네트워크 없이 돈다(§3.6, PRD §11.5 표).
- 국립중앙의료원·충남 시설·Kakao Local처럼 별도 키가 없는 연동은 기존대로 fixture 우선을 유지한다 — 이번 지시는 OpenAI·Supabase 두 연동에 한정된다.
- fixture에는 여전히 `source`, `verified_at`, `is_demo`를 포함하고, 실제 연동 실패 시 폴백 문구에도 `데모 데이터`가 아니라 "지금은 연결할 수 없어요" 같은 정직한 오류 상태를 표시한다(둘을 혼동하지 않는다).
- timeout, 4xx, 5xx, malformed XML/JSON, 빈 결과, 오래된 기준일을 모두 테스트한다.
- OpenAI smoke test는 PRD §14.2에 따라 자격증명이 설정된 즉시 실행하고 결과(성공/실패만, 값 제외)를 `docs/DEVELOPMENT_LOG.md`에 남긴다.
- 실제 호출도 최소 요청만 보내고 응답 본문에 개인정보를 넣지 않으며 키·토큰·서명 URL을 로그·에러 메시지·테스트 스냅샷에 남기지 않는다.

---

## 4. 모든 Phase에 적용하는 TDD 루프

각 사용자 스토리마다 다음 순서를 지킨다.

### Red

1. Given/When/Then이 드러나는 가장 작은 실패 테스트를 먼저 작성한다.
2. 테스트가 요구사항 때문에 실패하는지 실행해 확인한다.
3. import 오류나 테스트 환경 오류를 기능 실패로 가장하지 않는다.

### Green

1. 방금 작성한 테스트를 통과시키는 최소 구현만 작성한다.
2. 관련 테스트를 다시 실행한다.
3. 정상·실패·권한 경로가 모두 통과할 때까지 범위를 넓히지 않는다.

### Refactor

1. 중복, 불명확한 이름, provider 결합을 제거한다.
2. 리팩터링 전후 동작이 같음을 테스트로 확인한다.
3. 타입 검사와 lint를 함께 실행한다.

### Phase 품질 게이트

Phase 완료 전 최소한 아래 스크립트를 프로젝트에 제공하고 실행한다.

```text
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

E2E가 생긴 뒤에는 관련 Playwright test도 실행한다. 실제 스크립트 이름이 다르면 `package.json`의 표준 이름으로 정리하고 문서화한다. 실패가 있으면 commit/push하지 않는다.

---

## 5. 단계별 개발 Phase

## Phase 0 — 저장소 안전·기반선

목표는 비밀정보 유출 없이 개발을 시작할 수 있는 상태를 만드는 것이다.

먼저 실패 테스트 또는 자동 검사를 만든다.

- 필수 환경변수 validator가 실제 값 없이 누락 이름만 반환하는 테스트
- 모델 ID 중앙 설정의 기본값 테스트
- 실제 `.env`가 Git stage 대상에서 제외되는지 확인하는 안전 검사

구현 범위:

- 기존 파일·Git 상태 보고
- `.gitignore` 안전 규칙
- `.env.example`에 PRD의 변수명과 빈 값/설명 반영
- Next.js/TypeScript/test runner의 최소 골격 또는 기존 구조 보완
- `README.md`에 로컬 개발, mock 모드, 품질 명령 추가
- `docs/DEVELOPMENT_LOG.md` 생성

완료 조건:

- 실제 키 없이 테스트가 실행된다.
- `.env`가 staged 목록에 절대 나타나지 않는다.
- `index.html`과 PRD가 보존된다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
chore: TDD 개발 기반과 비밀정보 보호 설정 추가
```

## Phase 1 — 역할별 접근 가능한 UI 골격

테스트를 먼저 작성한다.

- `/senior`, `/family`, `/worker`의 역할별 렌더링
- 다른 역할 경로 접근 차단
- 노인 화면의 큰 말하기, 텍스트 입력, 고정 긴급 버튼
- 200% 확대와 키보드 포커스에 필요한 핵심 접근성 속성
- `data-density="comfort"`가 적용된 화면에서 터치 타깃 최소 크기가 유지됨

구현 범위:

- **`DESIGN.md` §2의 토큰을 `app/globals.css`의 CSS 변수로 그대로 옮긴다.** 색·간격·라운딩·타이포 값이 이 한 파일에만 존재해야 한다.
- 밀도 스케일은 루트 `data-density` 속성으로 변수만 교체하는 방식으로 구현한다. 노인용 별도 컴포넌트를 만들지 않는다.
- 공통 컴포넌트: 카드, 1차/2차/위험 버튼, 상태 배지, AI 배지, 데모 배지
- 세로 1열 스택 기본 레이아웃. `/worker`만 사이드바 + `auto-fill` 그리드
- 가짜 세션 기반 역할 라우팅. 실제 Supabase 연결은 adapter 뒤로 미룬다.
- 한 화면 한 과업, 선택지 최대 2개 원칙

완료 조건:

- 세 역할 화면이 독립적으로 테스트된다.
- 노인 핵심 행동은 한 번의 터치로 시작한다.
- 컴포넌트 파일에 토큰 밖의 색상 리터럴이나 임의 px 값이 없다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 디자인 토큰과 역할별 접근 가능한 화면 골격 구현
```

## Phase 2 — 도메인 모델·요청·동의·권한

테스트를 먼저 작성한다.

- 관계 없는 가족/복지사가 senior 데이터를 조회하지 못함
- 만료·철회된 동의가 즉시 접근을 차단함
- 요청 카드 상태 전이의 허용/거부 규칙 (`draft → new → in_progress → done | rejected`)
- 노인이 `in_progress` 카드를 직접 취소하려 하면 서버가 거부함
- `draft` 카드가 서버에 저장되지 않고 다른 역할 조회 결과에 포함되지 않음
- 역할별 상태 문구 매핑이 PRD §7.4 표와 일치함
- `transcript`가 동의 없는 가족의 조회 결과에서 제외됨
- 고위험 도구에 확인 토큰이 없으면 서버가 거부함
- 동일 idempotency key의 요청이 중복 생성되지 않음

구현 범위:

- 요청 카드 domain type과 상태 머신, Zod schema
- 역할별 상태 문구 매핑 함수 (UI가 아니라 domain에 둔다)
- repository ports + in-memory fake
- Supabase migration/RLS 정책 초안
- audit log와 consent versioning
- 일반 요청과 관리자 경로 분리

완료 조건:

- 모든 권한 결정은 UI가 아니라 서버/domain에서 재검증된다.
- RLS 정책 테스트 또는 재현 가능한 검증 SQL이 있다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 동의 기반 요청 도메인과 권한 정책 구현
```

## Phase 3 — 텍스트·음성 챗봇과 TTS

테스트를 먼저 작성한다.

- 텍스트 입력이 구조화된 assistant turn을 생성함
- 음성 입력이 전사 확인 단계를 거침
- 복지 의도로 분류된 발화가 요청 카드 초안(`draft`)을 만듦
- 음성 입력과 텍스트 입력이 `input_type`만 다른 동일 구조의 카드를 만듦
- 누락 필드를 한 번에 하나씩 되묻고 답변마다 초안이 갱신됨
- 노인 확인 전에는 카드가 서버에 저장되지 않음
- `assistant_turn_id` 소유권/관계가 없으면 TTS 403
- 답변 텍스트가 먼저 표시되고 음성 상태가 독립적으로 변함
- TTS 5초 timeout/오류 시 브라우저 폴백
- 새 답변 또는 녹음 시작 시 이전 음성 취소
- 음성 끄기 선호와 다시 듣기
- 실제 OpenAI adapter를 호출하지 않는 계약 테스트

구현 범위:

- `/api/ai/transcribe`, `/api/ai/respond`, `/api/ai/speech`
- OpenAI port와 fake adapter
- `gpt-transcribe`, `gpt-5.6-terra`, `gpt-4o-mini-tts` 중앙 라우팅
- Responses의 structured output schema와 `store: false`
- `SpeechStatus` 상태 머신과 Web Speech 폴백
- 고정 긴급 안내 문구/로컬 자산

완료 조건:

- 텍스트와 음성 입력 모두 같은 대화 use case를 사용한다.
- 모든 assistant turn에 텍스트와 음성/명시적 폴백이 있다.
- 비밀 값과 원본 오디오가 DB·로그·snapshot에 남지 않는다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 전사와 음성 출력을 갖춘 노인 챗봇 구현
```

## Phase 4 — 요청 카드 등록과 실시간 업무함 반영

이 Phase가 사용자가 요구한 핵심 수직 흐름이다. **노인이 말한 요청이 확인 즉시 사회복지사 업무함에 뜬다.**

테스트를 먼저 작성한다.

- 노인 확인 후 `POST /api/service-requests`가 `new` 카드를 생성함
- 같은 idempotency key의 재전송이 카드를 중복 생성하지 않음
- 담당 복지사의 업무함 컴포넌트가 fake realtime adapter의 INSERT 이벤트를 받아 새로고침 없이 목록 맨 위에 카드를 추가함
- 새 카드가 `미확인` 표시를 갖고 `신규` 카운트가 증가함
- 담당 관계가 없는 복지사의 구독에는 이벤트가 전달되지 않음
- 같은 카드 이벤트가 두 번 도착해도 목록에 한 번만 나타남 (`id` upsert)
- `updated_at`이 더 오래된 이벤트가 최신 상태를 덮어쓰지 않음
- 연결이 끊겨도 기존 목록이 비워지지 않고 연결 상태가 표시됨
- 재연결 후 누락 카드가 서버 재조회로 채워짐
- realtime adapter를 완전히 비활성화해도 목록 조회로 같은 카드가 보임
- 복지사의 상태 변경이 노인 화면의 문구를 §7.4 매핑대로 갱신함
- 노인 화면에 내부 행정 메모가 렌더링되지 않음

구현 범위:

- `GET`/`POST` `/api/service-requests`, `PATCH /api/service-requests/:id`
- Realtime port + in-memory fake + Supabase adapter
- 담당 관계 기반 구독 필터와 RLS 정책
- `id` 기준 upsert 목록 스토어와 재연결·재조회 로직
- 세 화면이 공유하는 요청 카드 컴포넌트 (밀도·행동 버튼만 분기)

완료 조건:

- 실시간을 꺼도 새로고침으로 동일한 데이터가 보인다.
- 구독 범위가 서버(RLS)에서 강제되고 클라이언트 필터링에 의존하지 않는다.
- 카드 컴포넌트가 세 화면에서 재사용된다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 요청 카드 등록과 실시간 업무함 반영 구현
```

## Phase 5 — 긴급 대응 수직 흐름

테스트를 먼저 작성한다.

- 긴급 표현 20개 재현율 목표와 비긴급 유사 표현
- “가슴이 아프지 않아” 같은 부정 표현
- AI adapter가 실패해도 고정 긴급 버튼과 규칙이 작동함
- 승인 전 실제 연락 함수가 실행되지 않음
- 가족/복지사 알림과 처리자 타임라인
- 실제 119 발신/접수 완료 상태가 생성되지 않음

구현 범위:

- urgency rule engine + model 결과 결합
- 긴급 화면, `tel:` 링크 직전 확인, 위치 권한 폴백
- emergency event/action과 감사 로그
- Realtime 상태 갱신은 Supabase adapter/fake 양쪽 제공

완료 조건:

- 모델/네트워크가 없어도 긴급 UI가 열린다.
- 허위 `신고 완료` 표현이 없다.
- 권한과 감사 테스트가 통과한다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 사람 확인 기반 긴급 대응 흐름 구현
```

## Phase 6 — 병원·복지시설·정책 조회

테스트를 먼저 작성한다.

- 국립중앙의료원 XML 정상/빈 결과/오류/timeout 정규화
- 충남 JSON/XML schema 변경 방어
- 출처·기준일·데모 여부 표시
- 키가 없으면 API route가 안전한 설정 오류 또는 fixture 모드로 동작
- 실제 접수 기능으로 오인할 문구가 없음

구현 범위:

- provider별 adapter와 normalized facility type
- 서버 timeout, retry 상한, circuit/fallback 정책
- versioned synthetic fixture
- Kakao Local은 기능 플래그가 켜지고 키가 있을 때만 노출

완료 조건:

- 기본 테스트는 네트워크 없이 재현 가능하다.
- 장애 시 최근 검증 fixture와 명확한 기준일이 표시된다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 공공 시설 검색과 장애 폴백 구현
```

## Phase 7 — 권한 문서와 동의 증적

테스트를 먼저 작성한다.

- PDF/JPEG/PNG 이외 형식, 5MB 초과, MIME 위장 차단
- object path에 PII가 들어가지 않음
- 비공개 버킷 외 업로드 거부
- 권한 있는 사용자에게만 인증 다운로드를 제공하고, 미리보기 signed URL은 60초 이하로 제한
- 동의 철회 후 인증 다운로드와 새 signed URL 발급 차단
- 외부 증빙과 앱 내부 구조화 동의의 정본 규칙 구분
- 문서 객체가 OpenAI adapter payload에 들어가지 않음

구현 범위:

- 문서 metadata, consent artifact, access log schema
- Storage port + fake adapter
- 합성 문서 업로드/검토 상태 UI
- structured consent + versioned PDF rendering interface
- 임시/데모 문서 삭제 job의 테스트 가능한 use case

완료 조건:

- Base64/BLOB DB 저장이 없다.
- 공개 URL이 없다.
- `업로드됨`과 `기관 검토 완료`가 구분된다.
- Free 플랜 70% 경고/85% 차단 정책이 테스트된다.
- 품질 게이트가 통과한다.

권장 커밋:

```text
feat: 비공개 권한 문서와 동의 증적 관리 구현
```

## Phase 8 — 전체 E2E·접근성·복구

테스트를 먼저 작성한다.

- 병원동행 요청 전체 수직 흐름: 노인 발화 → 초안 확인 → 등록 → **열려 있는 복지사 업무함에 새로고침 없이 카드 등장** → 상태 변경 → 노인 화면 문구 갱신
- 두 브라우저 컨텍스트(노인/복지사)를 동시에 열고 실시간 반영을 검증
- 긴급 발화 → 알림 → 가족 확인 → 복지사 반영
- TTS, OpenAI, Supabase Realtime, 공공 API 각각의 장애 시나리오
- 200% 확대, 키보드, 스크린 리더 live region, 음성 중복 방지
- 다른 사용자의 URL/ID/assistant turn/document 직접 접근 차단

구현 범위:

- Playwright E2E와 접근성 자동 검사
- 오류 경계, loading/empty/error 상태
- 데모 시드/fixture reset 명령
- 네트워크 장애용 발표 백업 경로

완료 조건:

- 핵심 두 시나리오를 세 번 연속 통과한다.
- 타입·lint·unit/integration/E2E/build가 모두 통과한다.
- 실제 키 없이 mock 데모가 실행된다.

권장 커밋:

```text
test: 핵심 돌봄 흐름 E2E와 접근성 검증 추가
```

## Phase 9 — 릴리스 문서·커밋 로그·push

먼저 현재 상태를 읽고 누락을 테스트/검증한다.

- README의 명령이 실제로 동작하는지 확인
- `.env.example`의 변수명이 PRD와 중앙 config에 일치하는지 확인
- tracked 파일에 비밀이나 실제 개인정보가 없는지 확인
- 모든 품질 게이트 재실행
- `git diff --check` 실행

구현 범위:

- `docs/DEVELOPMENT_LOG.md`를 최종 정리한다.
- 이전 Phase 커밋의 실제 hash, 제목, 변경 요약, 실행한 테스트를 `docs/COMMIT_LOG.md`에 기록한다.
- 현재 로그 정리 커밋 자체는 `문서 로그 정리 커밋`으로 표기해 순환 갱신하지 않는다.
- 배포 전 체크리스트와 알려진 제한을 README에 기록한다.

권장 최종 문서 커밋:

```text
docs: 개발 검증 결과와 커밋 로그 정리
```

push 조건:

1. 원격 `origin`과 목표 브랜치를 다시 확인한다.
2. 사용자의 push 승인이 있는지 확인한다.
3. 로컬이 원격보다 뒤처졌다면 덮어쓰지 말고 fetch 후 차이를 보고한다.
4. force push는 금지한다.
5. 최초 push는 승인 후 `git push -u origin main`, 이후에는 허가 범위에서 일반 `git push`만 사용한다.
6. push 결과와 원격 commit hash를 보고한다.

---

## 6. Phase별 반복 프롬프트

아래 템플릿에서 번호와 이름만 바꿔 Codex Terra에 전달한다.

```text
통합 프롬프트의 모든 공통 규칙을 유지하고 Phase <번호> — <이름>만 수행하라.

1. PRD의 관련 요구사항과 현재 구현을 먼저 대조하라.
2. 이번 Phase의 테스트 목록을 짧게 제시하고 곧바로 Red 테스트를 작성·실행하라.
3. Green 최소 구현 후 Refactor하고 관련 전체 품질 게이트를 실행하라.
4. 실제 외부 API는 호출하지 말고 mock/fixture만 사용하라.
5. 사용자 변경과 index.html을 보존하고 .env 값을 읽어 출력하거나 stage하지 마라.
6. docs/DEVELOPMENT_LOG.md에 변경·의사결정·검증 결과를 반영하라.
7. staged diff와 비밀정보를 검사한 뒤 테스트가 모두 통과할 때만 권장 메시지로 커밋하라.
8. GitHub push는 원격과 내 승인 여부를 확인한 뒤에만 수행하라.
9. 완료 보고에는 변경 파일, Red에서 확인한 실패, Green/Refactor 결과, 실행한 명령과 결과, commit hash, push 여부, 남은 위험을 포함하라.

다른 Phase 구현은 시작하지 말고 여기서 멈춰라.
```

버그 수정은 다음 템플릿을 사용한다.

```text
보고된 버그를 재현하는 실패 테스트를 먼저 추가하라. 테스트가 올바른 이유로 실패하는 것을 확인한 뒤 최소 수정하고 전체 관련 테스트를 실행하라. 회귀 위험과 영향을 받은 PRD 요구사항을 DEVELOPMENT_LOG에 기록하라. 테스트 통과 전 commit/push하지 마라.
```

---

## 7. 개발 로그 형식

각 Phase에서 `docs/DEVELOPMENT_LOG.md`에 아래 형식으로 한 항목을 추가한다. 비밀 값과 실제 개인정보는 기록하지 않는다.

```markdown
## YYYY-MM-DD HH:mm — Phase N: 제목

- 목표:
- PRD 요구사항:
- Red: 먼저 실패한 테스트와 실패 이유
- Green: 최소 구현
- Refactor: 구조 개선
- 변경 파일:
- 검증 명령과 결과:
- 의사결정:
- 알려진 제한/다음 단계:
- 예정 커밋 메시지:
```

최종 `docs/COMMIT_LOG.md` 형식은 다음과 같다.

```markdown
| Commit | 제목 | 핵심 변경 | 검증 |
|---|---|---|---|
| abc1234 | feat: ... | ... | unit, typecheck, lint, build |
```

---

## 8. 커밋 규칙

- 한 Phase당 하나 이상의 **통과 상태** 커밋을 만든다. 큰 Phase는 독립적으로 되돌릴 수 있는 세로 기능 단위로 나눌 수 있다.
- Red 테스트를 먼저 작성하지만 실패 상태 자체를 `main`에 커밋하거나 push하지 않는다.
- Conventional Commit 접두사를 사용한다: `chore`, `test`, `feat`, `fix`, `refactor`, `docs`.
- 제목은 명령형 한국어로 짧게 작성한다.
- 서로 무관한 파일을 한 커밋에 섞지 않는다.
- 사용자 기존 변경을 포함해야 한다면 소유권과 범위를 먼저 확인한다.
- commit 전 `git diff --cached`를 읽고 변경 이유를 설명할 수 없는 내용은 빼낸다.
- hook 실패를 우회하는 `--no-verify`를 쓰지 않는다.

---

## 9. 완료 보고 형식

각 Phase 완료 시 다음 순서로 간결하게 보고한다.

```text
결과: Phase N 완료/미완료

구현:
- ...

TDD 증거:
- Red: ... 테스트가 ... 이유로 실패
- Green: ...
- Refactor: ...

검증:
- npm test -- --run: PASS/FAIL
- npm run typecheck: PASS/FAIL
- npm run lint: PASS/FAIL
- npm run build: PASS/FAIL
- 관련 E2E: PASS/FAIL/해당 없음

Git:
- commit: <hash> <title> 또는 미커밋 사유
- push: <remote/branch/result> 또는 미실행 사유

남은 위험/다음 Phase:
- ...
```

전체 완료 보고에서는 `docs/COMMIT_LOG.md`, 최종 품질 게이트, 원격 push 상태, 실제 외부 API 미검증 항목을 반드시 포함한다. 문서상 API가 존재한다는 사실을 실제 계정 호출 성공으로 표현하지 않는다.

---

## 10. 절대 완료로 간주하지 않는 상태

- UI만 있고 테스트가 없음
- 테스트가 mock 내부 구현만 확인하고 사용자 행동·권한 결과를 검증하지 않음
- 텍스트 입력 시 음성 답변이 빠짐
- TTS 실패가 전체 챗봇 실패로 이어짐
- 노인이 등록한 요청이 복지사 업무함에 새로고침 없이 나타나지 않음
- 실시간 계층을 끄면 요청 데이터가 아예 보이지 않음 (실시간에 정본을 의존함)
- 구독 범위를 RLS가 아니라 클라이언트 필터링으로만 제한함
- 확인 전 `draft` 카드가 서버에 저장되거나 다른 역할 화면에 노출됨
- 역할마다 별도의 요청 데이터 구조나 별도 카드 컴포넌트를 만듦
- 노인 화면에 내부 행정 메모나 행정 용어 상태값이 그대로 노출됨
- 상태 전이 검증을 서버가 아니라 UI 버튼 숨김으로만 처리함
- `DESIGN.md` 토큰 밖의 색상 리터럴이나 임의 px 값을 컴포넌트에 직접 씀
- 모델이 직접 SQL/URL/고위험 동작을 실행함
- v1.2에서 제거한 음식 사진 분석이나 이미지 입력 AI 경로가 다시 추가됨
- 엔드포인트별로 별도 OpenAI 키 변수를 추가하거나 모델 ID를 중앙 설정 밖에 하드코딩함
- 실제 문서가 공개 버킷, DB Base64, 로그, OpenAI payload 중 하나에 들어감
- 동의 철회 후 기존 접근이 계속됨
- `.env` 또는 키가 staged/tracked 상태임
- 테스트·typecheck·lint·build 중 하나가 실패함
- 커밋하지 않았는데 commit 완료라고 보고함
- 원격이 없거나 push가 실패했는데 GitHub 반영 완료라고 보고함
- fixture 결과를 실제 기관 접수 또는 실시간 최신 데이터라고 표시함
- (v1.4 이후) 자격증명이 있는데도 운영 코드 경로가 하드코딩 mock/fixture로 응답함
- (v1.4 이후) 실제 호출 실패를 사용자에게 알리지 않고 조용히 mock 데이터로 대체함
- (v1.4 이후) 서버 재시작 시 등록된 요청 카드가 사라짐 (in-memory만 쓰고 Supabase에 저장하지 않음)

이 조건 중 하나라도 남으면 작업은 완료가 아니다. 정확한 실패 지점, 재현 명령, 안전한 다음 행동을 보고한다.
