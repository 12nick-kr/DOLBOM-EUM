import type { ReactNode } from 'react';
import { requestTypeLabel, statusLabelFor, statusToneFor } from '@/lib/domain/policies';
import type { Role, ServiceRequestView } from '@/lib/domain/types';
import { StatusPill } from './StatusPill';
import { formatDesiredDate } from '@/lib/domain/dateResolution';
import { scheduleStateFor, scheduleStateLabel } from '@/lib/domain/requestSchedule';

export type CareRequestCardProps = {
  /** 서버가 역할별 redaction과 함께 담당 노인 이름(`seniorName`)을 붙여 내려준다. */
  card: ServiceRequestView & { transcript?: string };
  role: Role;
  unread?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  onDelete?: (id: string) => void;
  deleting?: boolean;
};

/** 세 역할이 공유하는 요청 카드. 역할 차이는 메타 공개 범위와 행동 영역에만 둔다. */
export function CareRequestCard({ card, role, unread = false, onSelect, actions, onDelete, deleting = false }: CareRequestCardProps) {
  const desiredDate = formatDesiredDate(card.details);
  const scheduleState = scheduleStateFor(card);
  // 이름이 아직 없으면 특정 인물을 지어내지 않고 중립 문구를 보여 준다.
  const seniorName = card.seniorName ? `${card.seniorName} 어르신` : '담당 어르신';
  return (
    <article className={`care-request-card${unread ? ' unread' : ''}`} data-density={role === 'senior' ? 'comfort' : 'standard'} data-status-tone={statusToneFor(card.status)} data-risk-tone={card.riskLevel ?? 'normal'}>
      <div className="care-card-heading">
        <StatusPill status={statusLabelFor(role, card.status)} />
        {role === 'worker' && card.riskLevel === 'emergency' && <StatusPill status="긴급 확인 필요" />}
        {role === 'worker' && card.riskLevel === 'attention' && <StatusPill status="안전 확인 필요" />}
        {card.status !== 'done' && <StatusPill status={scheduleStateLabel[scheduleState]} />}
        {unread && <span className="pill blue">미확인</span>}
        {role === 'worker' && onDelete && <button className="care-card-delete" aria-label="요청 삭제" disabled={deleting} onClick={() => onDelete(card.id)}>{deleting ? '삭제 중' : '삭제'}</button>}
      </div>
      <div>
        <p className="eyebrow">{requestTypeLabel[card.type]}</p>
        <strong className="care-card-summary"><span className="ai-pill">AI</span>{card.summary}</strong>
      </div>
      <dl className="care-card-meta">
        {role === 'worker' && <><dt>대상</dt><dd>{seniorName}</dd></>}
        {desiredDate && <><dt>희망 일시</dt><dd>{desiredDate}</dd></>}
        {card.details.destination && <><dt>목적지</dt><dd>{card.details.destination}</dd></>}
        {role !== 'family' && <><dt>입력 방식</dt><dd>{card.inputType === 'voice' ? '음성' : '텍스트'}</dd></>}
        {role === 'worker' && card.riskReasons && card.riskReasons.length > 0 && <><dt>안전 분류 근거</dt><dd>{card.riskReasons.join(', ')}</dd></>}
        {role !== 'family' && card.completedAt && <><dt>완료 시각</dt><dd>{new Date(card.completedAt).toLocaleString('ko-KR')}</dd></>}
      </dl>
      {role === 'worker' && card.transcript && <details className="worker-transcript"><summary>확인한 원문 보기</summary><p>{card.transcript}</p></details>}
      {(onSelect || actions) && <div className="care-card-actions">
        {onSelect && <button className="secondary" onClick={onSelect}>상세 보기</button>}
        {actions}
      </div>}
    </article>
  );
}
