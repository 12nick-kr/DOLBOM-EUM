import type { EmergencyEvent, PersistedRequestStatus, RequestStatus, Role, ServiceRequest } from './types';

/**
 * PRD §7.4 상태 전이표:
 *   draft ──(노인 확인)──> new ──(담당 지정/열람)──> in_progress ──> done
 *                           │                            │
 *                           └──(노인 취소, canCancelRequest)  └──> rejected
 *
 * `draft → new`는 노인 확인 시점에 서버가 카드를 처음 생성하는 것으로 표현되며(=요청 생성),
 * 그 뒤의 상태 갱신은 이 표만 참조한다. 허용되지 않은 전이는 서버가 거부한다.
 */
const transitions: Record<RequestStatus, RequestStatus[]> = {
  draft: ['new'],
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

/** 노인은 `new`까지만 취소할 수 있다. `in_progress` 이후 취소는 복지사에게 `정보 확인 요청`으로 전달된다. */
export function canCancelRequest(actor: Role, status: PersistedRequestStatus): boolean {
  if (actor !== 'senior') return false;
  return status === 'new';
}

export function canViewSenior(actor: Role, relationActive: boolean, consentActive: boolean): boolean {
  return actor === 'senior' || (relationActive && consentActive);
}

export function needsConfirmation(token?: string): boolean {
  return token !== 'confirmed';
}

/** PRD §7.4 "역할별 상태 문구" 표. 노인 화면에는 행정 용어를 쓰지 않는다. */
const statusLabels: Record<Role, Record<PersistedRequestStatus, string>> = {
  senior: { new: '담당자에게 보냈어요', in_progress: '담당자가 확인 중이에요', done: '도움이 연결됐어요', rejected: '담당자가 다시 연락드릴 거예요' },
  family: { new: '접수됨', in_progress: '처리 중', done: '완료', rejected: '확인 필요' },
  worker: { new: '신규', in_progress: '진행중', done: '완료', rejected: '반려' },
};

export function statusLabelFor(role: Role, status: PersistedRequestStatus): string {
  return statusLabels[role][status];
}

/**
 * DESIGN.md §6 상태 색 매핑을 텍스트가 아닌 `status` 값 자체에 직접 건다.
 * 역할별 라벨 문구(예: "접수됨", "진행중")는 §6 정규식과 안정적으로 매치되지 않으므로
 * 카드 좌측 강조 바 등 상태색이 필요한 곳은 라벨이 아니라 이 함수를 근거로 삼는다.
 */
export function statusToneFor(status: PersistedRequestStatus): 'red' | 'amber' | 'mint' | 'blue' | 'gray' {
  if (status === 'new') return 'blue';
  if (status === 'in_progress') return 'amber';
  if (status === 'done') return 'mint';
  return 'gray';
}

/** 요청 종류 표기는 세 역할 화면이 동일해야 하므로 여기서만 정의한다. */
export const requestTypeLabel: Record<ServiceRequest['type'], string> = {
  hospital_escort: '병원 동행 요청',
  welfare_info: '복지 정보 안내',
  daily_help: '일상 도움 요청',
};

export function emergencyStatusLabel(status: EmergencyEvent['status']): string {
  if (status === 'closed') return '긴급 종료됨';
  if (status === 'worker_followup') return '사회복지사 대응 중';
  if (status === 'family_acknowledged') return '가족 확인 완료';
  return '긴급 · 미확인';
}

/**
 * `transcript`는 노인 본인과 담당 복지사에게만 보인다. 가족에게는 동의 범위에 따라
 * `summary`와 상태만 공유하며, 원문 공유는 별도 동의 항목이다 (PRD §7.4).
 */
export function redactForRole(card: ServiceRequest, role: Role, opts: { transcriptConsent: boolean }): ServiceRequest & { transcript?: string } {
  if (role === 'senior' || role === 'worker') return card;
  if (opts.transcriptConsent) return card;
  const { transcript: _transcript, ...rest } = card;
  return rest as ServiceRequest & { transcript?: string };
}
