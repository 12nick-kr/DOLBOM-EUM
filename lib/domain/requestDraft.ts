import type { RequestDetails, RequestInputType, RequestType, ServiceRequestDraft } from './types';

const destinationPattern = /([가-힣A-Za-z0-9]+(?:병원|의원|보건소|복지관))/;
const datePattern = /(다음\s*주\s*[월화수목금토일]요일|다음\s*주|이번\s*주\s*[월화수목금토일]요일|오늘|내일|모레|\d{1,2}월\s*\d{1,2}일)/;

function extractType(text: string): RequestType {
  if (/병원|동행/.test(text)) return 'hospital_escort';
  if (/복지|정보|안내/.test(text)) return 'welfare_info';
  return 'daily_help';
}

function extractDetails(text: string): RequestDetails {
  const destinationMatch = text.match(destinationPattern);
  const dateMatch = text.match(datePattern);
  const details: RequestDetails = {};
  if (destinationMatch) details.destination = destinationMatch[1];
  if (dateMatch) details.desiredAt = dateMatch[1];
  if (/같이|동행|도움|모시고/.test(text)) details.needsTransportHelp = true;
  return details;
}

/**
 * 발화(또는 되물음에 대한 답)에서 요청 카드 초안을 만든다. 누락 필드는 한 번에 하나씩만 되묻는다 (PRD §7.1/FR-04).
 * 우선순위: 희망 날짜 > 목적지. 하나씩만 missingFields에 채운다.
 */
export function draftServiceRequest(params: { text: string; seniorId: string; inputType: RequestInputType; priorDraft?: ServiceRequestDraft }): ServiceRequestDraft {
  const type = params.priorDraft?.type ?? extractType(params.text);
  const newDetails = extractDetails(params.text);
  const details: RequestDetails = { ...params.priorDraft?.details, ...newDetails };
  const transcript = params.priorDraft ? `${params.priorDraft.transcript} ${params.text}` : params.text;

  // PRD §18.2 데모 시나리오: 비어 있는 시간(희망 날짜)만 한 번 되묻는다. 목적지는 병원명이 없으면
  // 담당자가 확인하는 것으로 안내하고(요약 문구), 되물음 루프를 두 단계로 늘리지 않는다.
  const missingFields: string[] = [];
  if (!details.desiredAt) missingFields.push('희망 날짜');

  const summary = type === 'hospital_escort'
    ? `${details.destination ? details.destination + ' ' : ''}병원 동행 도움이 필요해요. ${details.destination ? '' : '목적지는 담당자가 확인해요.'}`.trim()
    : type === 'welfare_info'
      ? '복지 정보 안내를 요청했어요.'
      : '일상 도움을 요청했어요.';

  return {
    seniorId: params.seniorId,
    type,
    summary,
    transcript,
    inputType: params.inputType,
    details,
    missingFields: missingFields.slice(0, 1),
  };
}
