import type { ReactNode } from 'react';
import { statusLabelFor } from '@/lib/domain/policies';
import type { Role, ServiceRequest } from '@/lib/domain/types';
import { StatusPill } from './StatusPill';

const typeLabel: Record<ServiceRequest['type'], string> = {
  hospital_escort: '병원 동행 요청',
  welfare_info: '복지 정보 안내',
  daily_help: '일상 도움 요청',
};

export type CareRequestCardProps = {
  card: ServiceRequest & { transcript?: string };
  role: Role;
  unread?: boolean;
  seniorName?: string;
  onSelect?: () => void;
  actions?: ReactNode;
};

/** 세 역할이 공유하는 요청 카드. 역할 차이는 메타 공개 범위와 행동 영역에만 둔다. */
export function CareRequestCard({ card, role, unread = false, seniorName = '김순자 어르신', onSelect, actions }: CareRequestCardProps) {
  return (
    <article className={`care-request-card${unread ? ' unread' : ''}`} data-density={role === 'senior' ? 'comfort' : 'standard'}>
      <div className="care-card-heading">
        <StatusPill status={statusLabelFor(role, card.status)} />
        {unread && <span className="pill blue">미확인</span>}
      </div>
      <div>
        <p className="eyebrow">{typeLabel[card.type]}</p>
        <strong className="care-card-summary"><span className="ai-pill">AI</span>{card.summary}</strong>
      </div>
      <dl className="care-card-meta">
        {role !== 'senior' && <><dt>대상</dt><dd>{seniorName}</dd></>}
        {card.details.desiredAt && <><dt>희망 일시</dt><dd>{card.details.desiredAt}</dd></>}
        {card.details.destination && <><dt>목적지</dt><dd>{card.details.destination}</dd></>}
        <dt>입력 방식</dt><dd>{card.inputType === 'voice' ? '음성' : '텍스트'}</dd>
        {role === 'worker' && card.transcript && <><dt>확인한 원문</dt><dd>{card.transcript}</dd></>}
      </dl>
      {(onSelect || actions) && <div className="care-card-actions">
        {onSelect && <button className="secondary" onClick={onSelect}>상세 보기</button>}
        {actions}
      </div>}
    </article>
  );
}
