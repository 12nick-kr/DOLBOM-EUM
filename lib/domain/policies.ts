import type { PersistedRequestStatus, RequestStatus, Role, ServiceRequest } from './types';

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
 * `transcript`는 노인 본인과 담당 복지사에게만 보인다. 가족에게는 동의 범위에 따라
 * `summary`와 상태만 공유하며, 원문 공유는 별도 동의 항목이다 (PRD §7.4).
 */
export function redactForRole(card: ServiceRequest, role: Role, opts: { transcriptConsent: boolean }): ServiceRequest & { transcript?: string } {
  if (role === 'senior' || role === 'worker') return card;
  if (opts.transcriptConsent) return card;
  const { transcript: _transcript, ...rest } = card;
  return rest as ServiceRequest & { transcript?: string };
}
