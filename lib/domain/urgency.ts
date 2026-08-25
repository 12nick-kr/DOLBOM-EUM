import type { IntentResult } from './types';

const emergencyTerms = ['가슴이 아프', '가슴이 아파', '가슴이 조이', '가슴이 조여', '숨이 차', '숨쉬기 힘들', '숨쉬기가 힘들', '의식이 없', '의식이없', '피가 많이', '심한 출혈', '죽고 싶', '자해', '쓰러졌'];
const isNegatedEmergency = (text: string) => /가슴이\s*아프지\s*않|숨이\s*차지\s*않|의식이\s*없지\s*않|출혈이\s*없/.test(text);

export function classifyUrgency(text: string): IntentResult {
  const compact = text.replace(/\s/g, '');
  const match = emergencyTerms.some((term) => compact.includes(term.replace(/\s/g, '')));
  const negated = match && isNegatedEmergency(text);
  if (match && !negated) return { intent: 'emergency', urgency: 'emergency', summary: '긴급 도움이 필요할 수 있는 표현이 감지되었어요.', missing_fields: [], proposed_tool: 'create_emergency_draft', requires_confirmation: true };
  if (/병원|동행|복지|도움.*필요/.test(text)) return { intent: 'service_request', urgency: 'welfare', summary: '병원 동행 도움 요청으로 정리했어요.', missing_fields: text.includes('다음') ? [] : ['희망 날짜'], proposed_tool: 'draft_service_request', requires_confirmation: true };
  if (/시설|복지관|병원.*찾/.test(text)) return { intent: 'facility_search', urgency: 'normal', summary: '가까운 시설 정보를 찾아볼게요.', missing_fields: [], proposed_tool: 'search_facility', requires_confirmation: false };
  return { intent: 'conversation', urgency: 'normal', summary: '일상 대화로 이해했어요.', missing_fields: [], proposed_tool: null, requires_confirmation: false };
}
