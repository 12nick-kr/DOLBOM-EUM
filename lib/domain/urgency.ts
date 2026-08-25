import type { IntentResult } from './types';

/**
 * 고정 긴급 키워드 규칙 (PRD §11.1 "고정 긴급 키워드와 부정 표현 규칙을 먼저 평가"). 정확한 문구
 * 매칭 대신 증상별 정규식을 써서 "너무", "정말" 같은 강조 부사가 핵심 표현 사이에 끼어도(예: "가슴이
 * 너무 아파서") 재현율이 떨어지지 않게 한다. 공백은 미리 제거한 텍스트에 대해 매칭한다.
 */
const emergencyPatterns: RegExp[] = [
  /가슴이?.{0,6}(아프|아파|조이|조여)/, // 가슴 통증
  /숨.{0,6}(차|막히|가쁘)/, // 호흡 곤란 (숨이 차다, 숨쉬기가 힘들다의 "차" 계열)
  /숨.{0,10}(쉬기|쉬는).{0,6}힘들/, // 숨쉬기가/숨을 쉬기가 힘들다
  /의식이?.{0,4}없/, // 의식 저하
  /(피가|출혈).{0,10}(많이|심하|멈추지)/, // 출혈이 많이/멈추지 않는다
  /심(한|하게).{0,6}(출혈|피)/, // 심한 출혈이다
  /죽고\s*싶/, // 자살 위험
  /자해/, // 자해 위험
  /쓰러졌/, // 실신/낙상
  /움직일\s*수가?\s*없/, // 거동 불가
  /(못|안)일어나/, // 낙상·급성 거동 불가 가능성
  /일어날.{0,4}(수|수가).{0,2}없/,
  /살려.{0,4}(줘|줘요|주세요)/, // 직접적 구조 요청
  /119(?![가-힣0-9]*동).{0,3}(에|로|좀|를)?.{0,6}(불러|불러줘|불러주세요|전화|신고)/, // 119 호출 요청 — "119동" 같은 주소 표현(음절 뒤에 "동"이 오는 경우)은 부정 전방탐색으로 제외한다
];

/** 부정 표현 — "가슴이 아프지 않아" 같은 문구는 긴급으로 분류하지 않는다. */
const negationPatterns: RegExp[] = [
  /가슴이?.{0,6}(아프|조이).{0,4}않/,
  /숨.{0,10}(차|힘들|막히).{0,4}않/,
  /의식이?.{0,4}없.{0,4}않/,
  /출혈.{0,4}없/,
  /(못|안)일어나.{0,5}(아니|않)/,
  /살려.{0,4}(줘|주세요).{0,4}(아니|않|필요.{0,2}없)/,
];

const attentionPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(어지럽|어지러|현기증)/, reason: '어지럼 증상' },
  { pattern: /(약을|약이).{0,8}(잘못|많이|두번|두 번)/, reason: '복약 오류 가능성' },
  { pattern: /(하루|오늘).{0,8}(못먹|못 먹|식사.{0,4}못)/, reason: '식사 곤란' },
  { pattern: /(넘어졌|넘어졌어|넘어졌는데)/, reason: '낙상 가능성' },
];

/** attention 패턴 오탐 방지 — "안 넘어졌어요", "어지럽지 않아요" 같은 부정 표현은 제외한다. */
const attentionNegationPatterns: RegExp[] = [
  /(안|못).{0,2}넘어졌/,
  /넘어졌.{0,4}(아니|않)/,
  /(어지럽|어지러|현기증).{0,6}(아니|않)/,
  /(약을|약이).{0,8}(잘못|많이|두번|두 번).{0,6}(아니|않)/,
];

export type SafetyRisk = { level: 'normal' | 'attention' | 'emergency'; reasons: string[] };

export function detectSafetyRisk(text: string): SafetyRisk {
  const compact = text.replace(/\s/g, '');
  const emergency = emergencyPatterns.some((pattern) => pattern.test(compact)) && !isNegated(compact);
  if (emergency) return { level: 'emergency', reasons: ['즉시 안전 확인이 필요한 표현'] };
  if (isAttentionNegated(compact)) return { level: 'normal', reasons: [] };
  const reasons = attentionPatterns.filter(({ pattern }) => pattern.test(compact)).map(({ reason }) => reason);
  return reasons.length > 0 ? { level: 'attention', reasons } : { level: 'normal', reasons: [] };
}

function isNegated(text: string): boolean {
  return negationPatterns.some((pattern) => pattern.test(text));
}

function isAttentionNegated(text: string): boolean {
  return attentionNegationPatterns.some((pattern) => pattern.test(text));
}

export function classifyUrgency(text: string): IntentResult {
  const risk = detectSafetyRisk(text);
  if (risk.level === 'emergency') return { intent: 'emergency', urgency: 'emergency', summary: '긴급 도움이 필요할 수 있는 표현이 감지되었어요.', missing_fields: [], proposed_tool: 'create_emergency_draft', requires_confirmation: true };
  if (risk.level === 'attention') return { intent: 'service_request', urgency: 'caution', summary: '안전 확인이 필요한 도움 요청으로 정리했어요.', missing_fields: [], proposed_tool: 'draft_service_request', requires_confirmation: true };
  if (/병원|동행|복지|도움.*필요/.test(text)) return { intent: 'service_request', urgency: 'welfare', summary: '병원 동행 도움 요청으로 정리했어요.', missing_fields: text.includes('다음') ? [] : ['희망 날짜'], proposed_tool: 'draft_service_request', requires_confirmation: true };
  if (/시설|복지관|병원.*찾/.test(text)) return { intent: 'facility_search', urgency: 'normal', summary: '가까운 시설 정보를 찾아볼게요.', missing_fields: [], proposed_tool: 'search_facility', requires_confirmation: false };
  return { intent: 'conversation', urgency: 'normal', summary: '일상 대화로 이해했어요.', missing_fields: [], proposed_tool: null, requires_confirmation: false };
}
