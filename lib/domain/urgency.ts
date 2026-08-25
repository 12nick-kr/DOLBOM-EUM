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
];

/** 부정 표현 — "가슴이 아프지 않아" 같은 문구는 긴급으로 분류하지 않는다. */
const negationPatterns: RegExp[] = [
  /가슴이?.{0,6}(아프|조이).{0,4}않/,
  /숨.{0,10}(차|힘들|막히).{0,4}않/,
  /의식이?.{0,4}없.{0,4}않/,
  /출혈.{0,4}없/,
];

function isNegated(text: string): boolean {
  return negationPatterns.some((pattern) => pattern.test(text));
}

export function classifyUrgency(text: string): IntentResult {
  const compact = text.replace(/\s/g, '');
  const matched = emergencyPatterns.some((pattern) => pattern.test(compact));
  const negated = matched && isNegated(compact);
  if (matched && !negated) return { intent: 'emergency', urgency: 'emergency', summary: '긴급 도움이 필요할 수 있는 표현이 감지되었어요.', missing_fields: [], proposed_tool: 'create_emergency_draft', requires_confirmation: true };
  if (/병원|동행|복지|도움.*필요/.test(text)) return { intent: 'service_request', urgency: 'welfare', summary: '병원 동행 도움 요청으로 정리했어요.', missing_fields: text.includes('다음') ? [] : ['희망 날짜'], proposed_tool: 'draft_service_request', requires_confirmation: true };
  if (/시설|복지관|병원.*찾/.test(text)) return { intent: 'facility_search', urgency: 'normal', summary: '가까운 시설 정보를 찾아볼게요.', missing_fields: [], proposed_tool: 'search_facility', requires_confirmation: false };
  return { intent: 'conversation', urgency: 'normal', summary: '일상 대화로 이해했어요.', missing_fields: [], proposed_tool: null, requires_confirmation: false };
}
