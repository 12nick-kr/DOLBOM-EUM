# 돌봄이음 AI

노인·부양가족·사회복지사가 권한에 맞게 상황을 함께 처리하는 **합성 데이터 전용** 챌린지 데모입니다. 모든 화면의 `챌린지 데모 — 실제 접수 아님` 표시는 실제 119 신고·기관 접수·문서 검증이 아님을 뜻합니다.

## 실행

```bash
npm install
npm run dev
```

- `http://localhost:3000/senior`: 큰 글씨, 음성/텍스트 입력, 요청 확인, 긴급 도움
- `http://localhost:3000/family`: 상태 요약, 위기 처리, 항목별 동의·대리 문서 상태
- `http://localhost:3000/worker`: 업무함, 사례 타임라인, AI 신청 초안

## 검증

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

OpenAI·Supabase 자격증명이 모두 있으면 실제 어댑터를 사용하고, 단위/E2E 테스트는 외부 통신 없이 in-memory/fixture 어댑터를 사용합니다. 요청 카드는 `GET /api/care-cards`, 노인이 확인한 입력 JSON은 `POST /api/senior-inputs`를 정본 진입점으로 사용합니다.

## 안전 설계

- `.env*`는 Git에서 제외하고 `.env.example`에는 빈 값과 변수명만 둡니다.
- OpenAI 모델 ID는 `lib/config.ts` 한 곳에서만 정하며 fixture AI는 `store: false` 정책을 표현합니다.
- 긴급 판단은 고정 규칙과 부정 표현을 함께 적용하며, 자동 신고나 `신고 완료` 표시는 하지 않습니다.
- TTS는 답변 텍스트를 먼저 보이고 Web Speech API 폴백을 제공합니다. 긴급 버튼은 TTS 실패에도 유지됩니다.
- 문서는 PDF/JPEG/PNG, 5MB, magic bytes를 검증하고 UUID 기반 private-path 계약만 제공합니다. 실제 문서·Base64·OCR/AI 전송은 지원하지 않습니다.
- `supabase/migrations/0001_demo_schema.sql`~`0004_service_request_delete.sql`은 저장소에 포함되지만 실제 프로젝트 적용은 소유자가 수행합니다.

## 알려진 제한과 배포 전 점검

- `0003_senior_input_events.sql`과 `0004_service_request_delete.sql`을 실제 Supabase 프로젝트에 순서대로 적용하기 전에는 통합 입력과 복지사 hard delete를 운영 환경에서 사용할 수 없습니다.
- 서버가 Supabase `postgres_changes`를 구독해 역할별로 정제한 SSE 이벤트를 전달합니다. 연결이 없으면 즉시 시작하는 1초 폴링으로 자동 복구하며, push가 연결되면 폴링을 멈춥니다. 데모 역할 쿠키는 실제 사용자 인증을 대신하지 않습니다.
- 실사용 전에는 Supabase RLS 정책/비공개 Storage, 외부 키 권한, 공공 API 최신성, 고령자 접근성 테스트, 개인정보·법률 검토를 완료해야 합니다.
- 실제 119 전화는 기기의 `tel:` 처리에 따라 다릅니다. 데모에서는 발신 직전 화면만 제공합니다.
