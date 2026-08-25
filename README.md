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

기본 구현은 in-memory fake와 버전 고정 fixture만 사용합니다. 실제 OpenAI, Supabase, 공공 API, Kakao 호출은 하지 않습니다. 실제 연결은 소유자가 환경변수를 설정하고 별도 승인한 smoke test에서만 검증합니다.

## 안전 설계

- `.env*`는 Git에서 제외하고 `.env.example`에는 빈 값과 변수명만 둡니다.
- OpenAI 모델 ID는 `lib/config.ts` 한 곳에서만 정하며 fixture AI는 `store: false` 정책을 표현합니다.
- 긴급 판단은 고정 규칙과 부정 표현을 함께 적용하며, 자동 신고나 `신고 완료` 표시는 하지 않습니다.
- TTS는 답변 텍스트를 먼저 보이고 Web Speech API 폴백을 제공합니다. 긴급 버튼은 TTS 실패에도 유지됩니다.
- 문서는 PDF/JPEG/PNG, 5MB, magic bytes를 검증하고 UUID 기반 private-path 계약만 제공합니다. 실제 문서·Base64·OCR/AI 전송은 지원하지 않습니다.
- `supabase/migrations/0001_demo_schema.sql`은 승인 전 실행하지 않는 RLS 설계 초안입니다.

## 알려진 제한과 배포 전 점검

- 모든 사용자·위치·문서·정책 결과는 합성 fixture입니다. 서버 재시작 시 초기화됩니다.
- 실사용 전에는 Supabase RLS 정책/비공개 Storage, 외부 키 권한, 공공 API 최신성, 고령자 접근성 테스트, 개인정보·법률 검토를 완료해야 합니다.
- 실제 119 전화는 기기의 `tel:` 처리에 따라 다릅니다. 데모에서는 발신 직전 화면만 제공합니다.
