'use client';
import { useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge'; import { StatusPill } from './StatusPill';
import { statusLabelFor } from '@/lib/domain/policies';
import type { ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { PollingRealtimeClient } from '@/lib/client/pollingRealtimeClient';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';

const typeLabel: Record<string, string> = { hospital_escort: '병원동행 요청', welfare_info: '복지 정보 안내', daily_help: '일상 도움 요청' };

async function fetchServiceRequests(): Promise<ServiceRequest[]> {
  const res = await fetch('/api/service-requests');
  const body = await res.json();
  return body.data as ServiceRequest[];
}

function useWorkerRealtime(): RealtimeClientPort {
  const [client] = useState(() => new PollingRealtimeClient(fetchServiceRequests));
  return client;
}

export function WorkerDashboard() {
  const [page, setPage] = useState<'dashboard' | 'inbox' | 'case' | 'request'>('dashboard');
  const [filter, setFilter] = useState('전체');
  const [approved, setApproved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nav = (target: typeof page) => setPage(target);

  const realtime = useWorkerRealtime();
  const { requests, connectionState, unreadCount, isUnread, acknowledge, refetch } = useServiceRequestList({ realtime, fetchList: fetchServiceRequests });

  const filtered = useMemo(() => requests.filter((item) => {
    if (filter === '전체') return true;
    if (filter === '신규') return item.status === 'new';
    if (filter === '진행중') return item.status === 'in_progress';
    return item.status === 'done';
  }), [requests, filter]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  const openRequest = (id: string) => {
    setSelectedId(id);
    acknowledge(id);
    nav('request');
  };

  const takeCharge = async (id: string) => {
    await fetch(`/api/service-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'in_progress' }) });
    await refetch();
    setApproved(true);
  };

  return <main className="worker-layout"><aside><div className="brand">돌봄이음 <em>AI</em></div><nav>{[['dashboard', '▦', '대시보드'], ['inbox', '☷', '요청 업무함'], ['case', '◉', '사례 관리'], ['dashboard', '⚙', '설정']].map(([target, icon, label], index) => <button className={page === target && (index < 2 || label === '사례 관리') ? 'active' : ''} onClick={() => nav(target as typeof page)} key={`${label}-${index}`}>{icon} {label}</button>)}</nav><div className="institution"><b>충남 돌봄복지관</b><span>박사회복지사</span></div></aside><section className="worker-content"><DemoBadge />{connectionState === 'disconnected' && <p className="notice" role="status">실시간 연결이 끊겼어요. 마지막으로 받은 목록을 보여주고 있어요 · 재연결 시도 중</p>}{page === 'dashboard' && <><header className="worker-header"><div><p className="eyebrow">2026년 8월 25일 월요일</p><h1>좋은 아침이에요, 박사회복지사님</h1></div><span className="avatar">박</span></header><div className="stats"><article><StatusPill status="긴급" /><strong>1</strong><span>미확인 긴급 알림</span></article><article><StatusPill status="주의" /><strong>2</strong><span>후속 확인 필요</span></article><article><StatusPill status="안정" /><strong>12</strong><span>안정 사례</span></article><article><StatusPill status="신규" /><strong>{requests.filter((r) => r.status === 'new').length}</strong><span>새 요청</span></article></div><button className="worker-emergency" onClick={() => nav('case')}><StatusPill status="긴급 · 미확인" /><div><strong>김순자 어르신 · 가슴 통증과 호흡 곤란</strong><p>가족 확인 대기 · 방금 전 감지</p></div><span>자세히 보기 ›</span></button><div className="worker-columns"><section className="card"><h2>7일 요청 추이</h2><div className="bar-chart">{[30, 50, 28, 70, 42, 80, 55].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div><small>월 · 화 · 수 · 목 · 금 · 토 · 일</small></section><section className="card"><h2>오늘 할 일</h2><ol><li>김순자 어르신 긴급 알림 확인</li><li>병원동행 신규 요청 배정</li><li>동의 만료 예정 2건 확인</li></ol><p className="ai-pill">🤖 AI 요약 · 우선순위는 데모 데이터예요.</p></section></div><section className="card"><h2>담당 노인</h2><button className="list-row" onClick={() => nav('case')}><b>김순자</b><StatusPill status="긴급" /><span>가족 확인 대기</span></button><div className="list-row"><b>이영희</b><StatusPill status="주의" /><span>복지 정보 확인</span></div></section></>}{page === 'inbox' && <><header className="worker-header"><h1>요청 업무함</h1><span className="pill blue" aria-live="polite">신규 {unreadCount}건</span></header><div className="filter-tabs">{['전체', '신규', '진행중', '완료'].map((item) => <button onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''} key={item}>{item}</button>)}</div>{filtered.length === 0 && <p className="notice">아직 요청이 없어요.</p>}{filtered.map((item) => <button className={`inbox-card${isUnread(item.id) ? ' unread' : ''}`} key={item.id} onClick={() => openRequest(item.id)}><StatusPill status={statusLabelFor('worker', item.status)} />{isUnread(item.id) && <span className="pill red">미확인</span>}<strong>{typeLabel[item.type] ?? item.type}</strong><p>{item.seniorId} · 기한 {item.dueAt ?? '담당자 확인'}</p><span>{item.summary}</span></button>)}</>}{page === 'case' && <><button className="back" onClick={() => nav('dashboard')}>‹ 대시보드</button><header className="case-header"><div className="profile">김</div><div><StatusPill status="긴급" /><h1>김순자 어르신</h1><p>78세 · 담당: 박사회복지사</p></div></header><div className="case-grid"><section className="card"><h2>기본 정보</h2><p>건강 주의사항: 심혈관 관련 주의 (합성 데이터)</p><p>동의 범위: 건강 요약·위치·위기 정보</p></section><section className="card"><h2>AI 행정 보조</h2><p className="ai-pill">🤖 AI 생성</p><p>사례기록 초안은 사실과 추정을 분리해 담당자 확인 후 저장해요.</p><button>초안 검토하기</button></section></div><section className="card"><h2>처리 타임라인</h2><p><b>10:15 · 시스템</b> · 긴급 표현 감지 <span className="ai-pill">AI 생성</span></p><p><b>10:16 · 김순자</b> · 119 전화 전 확인 대기</p><p><b>10:17 · 박사회복지사</b> · 후속 확인 필요</p></section><div className="case-actions"><a href="tel:119" className="danger">119 전화</a><button>가족에게 연락</button><button className="primary">대응 기록 추가</button></div></>}{page === 'request' && selected && <><button className="back" onClick={() => nav('inbox')}>‹ 요청 업무함</button><header className="worker-header"><div><StatusPill status={statusLabelFor('worker', approved ? 'in_progress' : selected.status)} /><h1>{typeLabel[selected.type] ?? selected.type}</h1></div></header><section className="request-detail"><div className="card"><h2>요청 정보</h2><p className="ai-pill">AI</p><p>{selected.summary}</p><p>희망 일시: {selected.details.desiredAt ?? '담당자 확인 필요'}</p><p>목적지: {selected.details.destination ?? '담당자 확인 필요'}</p></div><div className="card"><p className="ai-pill">🤖 AI 신청 초안</p><h2>노인맞춤돌봄서비스 연계 검토</h2><p>대상 조건: 연령·소득·지역은 담당자가 확인해야 해요.</p><a href="https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13520000045">출처: 정부24 · 기준일 2026-08-25</a></div><label className="memo"><span>담당자 메모</span><textarea placeholder="확인한 사실만 기록해 주세요." /></label></section><div className="case-actions"><button>정보 확인 요청</button><button className="primary" onClick={() => takeCharge(selected.id)}>담당 맡기</button></div></>}</section></main>;
}
