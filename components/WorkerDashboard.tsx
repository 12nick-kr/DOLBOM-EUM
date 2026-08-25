'use client';
import { useEffect, useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import { statusLabelFor } from '@/lib/domain/policies';
import type { EmergencyEvent, ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';

const typeLabel: Record<ServiceRequest['type'], string> = { hospital_escort: '병원동행 요청', welfare_info: '복지 정보 안내', daily_help: '일상 도움 요청' };
async function fetchServiceRequests(): Promise<ServiceRequest[]> { const response = await fetch('/api/care-cards'); const body = await response.json(); return Array.isArray(body.data) ? body.data : []; }
function useWorkerRealtime(): RealtimeClientPort { const [client] = useState(() => createRealtimeClient(fetchServiceRequests)); useEffect(() => () => client.dispose(), [client]); return client; }

export function WorkerDashboard() {
  const [page, setPage] = useState<'dashboard' | 'inbox' | 'case' | 'request'>('dashboard');
  const [filter, setFilter] = useState('전체');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const realtime = useWorkerRealtime();
  const { requests, connectionState, unreadCount, isUnread, acknowledge, refetch } = useServiceRequestList({ realtime, fetchList: fetchServiceRequests });

  useEffect(() => {
    let cancelled = false;
    const load = async () => { try { const response = await fetch('/api/emergencies'); const body = await response.json(); if (!cancelled) setEmergencies(Array.isArray(body.data) ? body.data : []); } catch { /* 마지막 목록 유지 */ } };
    void load(); const timer = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const filtered = useMemo(() => requests.filter((item) => filter === '전체' || (filter === '신규' && item.status === 'new') || (filter === '진행중' && item.status === 'in_progress') || (filter === '완료' && item.status === 'done')), [requests, filter]);
  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const latestEmergency = emergencies[0];
  const openRequest = (id: string) => { setSelectedId(id); acknowledge(id); setPage('request'); };
  const takeCharge = async (id: string) => { await fetch(`/api/service-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'in_progress' }) }); await refetch(); };

  return <main className="worker-layout">
    <aside><div className="brand">돌봄이음 <em>AI</em></div><nav><button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ 대시보드</button><button className={page === 'inbox' || page === 'request' ? 'active' : ''} onClick={() => setPage('inbox')}>☷ 요청 업무함</button><button className={page === 'case' ? 'active' : ''} onClick={() => setPage('case')}>◉ 사례 관리</button></nav><div className="institution"><b>충남 돌봄복지관</b><span>박사회복지사</span></div></aside>
    <section className="worker-content"><DemoBadge />
      {connectionState === 'disconnected' && <p className="notice" role="status">실시간 연결이 끊겼어요. 마지막 목록을 유지하며 재연결 중이에요.</p>}
      {page === 'dashboard' && <><header className="worker-header"><div><p className="eyebrow">담당 현황</p><h1>좋은 아침이에요, 박사회복지사님</h1></div><span className="avatar">박</span></header><div className="stats"><article><StatusPill status="긴급" /><strong>{emergencies.filter((event) => event.status === 'detected').length}</strong><span>미확인 긴급 알림</span></article><article><StatusPill status="신규" /><strong>{requests.filter((request) => request.status === 'new').length}</strong><span>새 요청</span></article><article><StatusPill status="진행중" /><strong>{requests.filter((request) => request.status === 'in_progress').length}</strong><span>처리 중 요청</span></article><article><StatusPill status="완료" /><strong>{requests.filter((request) => request.status === 'done').length}</strong><span>완료 요청</span></article></div>{latestEmergency && <button className="worker-emergency" onClick={() => setPage('case')}><StatusPill status={latestEmergency.status === 'detected' ? '긴급 · 미확인' : '긴급 · 확인됨'} /><div><strong>김순자 어르신 · {latestEmergency.utterance}</strong><p>{latestEmergency.location}</p></div><span>자세히 보기 ›</span></button>}<div className="worker-columns"><section className="card"><h2>최근 요청</h2><p>{requests[0]?.summary ?? '새 요청이 없어요.'}</p></section><section className="card"><h2>오늘 할 일</h2><ol>{requests.filter((request) => request.status !== 'done').slice(0, 3).map((request) => <li key={request.id}>{request.summary}</li>)}{requests.filter((request) => request.status !== 'done').length === 0 && <li>미처리 요청이 없어요.</li>}</ol></section></div><section className="card"><h2>담당 노인</h2><button className="list-row" onClick={() => setPage('case')}><b>김순자</b><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : requests.some((request) => request.status === 'new') ? '신규 요청' : '안정'} /><span>요청 {requests.length}건 · 긴급 {emergencies.length}건</span></button></section></>}
      {page === 'inbox' && <><header className="worker-header"><h1>요청 업무함</h1><span className="pill blue" aria-live="polite">신규 {unreadCount}건</span></header><div className="filter-tabs">{['전체', '신규', '진행중', '완료'].map((item) => <button onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''} key={item}>{item}</button>)}</div><div className="care-card-feed">{filtered.length === 0 && <p className="notice">아직 요청이 없어요.</p>}{filtered.map((item) => <CareRequestCard card={item} role="worker" unread={isUnread(item.id)} key={item.id} onSelect={() => openRequest(item.id)} />)}</div></>}
      {page === 'case' && <><button className="back" onClick={() => setPage('dashboard')}>‹ 대시보드</button><header className="case-header"><div className="profile">김</div><div><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : '담당 사례'} /><h1>김순자 어르신</h1><p>담당: 박사회복지사 · 요청 {requests.length}건</p></div></header>{latestEmergency && <section className="card"><h2>최근 긴급 현황</h2><p>{latestEmergency.utterance}</p><p>{latestEmergency.location} · {new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</p></section>}<section className="care-card-feed">{requests.map((item) => <CareRequestCard card={item} role="worker" key={item.id} onSelect={() => openRequest(item.id)} />)}</section></>}
      {page === 'request' && selected && <><button className="back" onClick={() => setPage('inbox')}>‹ 요청 업무함</button><header className="worker-header"><div><StatusPill status={statusLabelFor('worker', selected.status)} /><h1>{typeLabel[selected.type]}</h1></div></header><CareRequestCard card={selected} role="worker" /><section className="request-detail"><div className="card"><p className="ai-pill">🤖 AI 신청 초안</p><h2>노인맞춤돌봄서비스 연계 검토</h2><p>대상 조건은 담당자가 확인해야 해요.</p></div><label className="memo"><span>담당자 메모</span><textarea placeholder="확인한 사실만 기록해 주세요." /></label></section><div className="case-actions"><button>정보 확인 요청</button>{selected.status === 'new' && <button className="primary" onClick={() => takeCharge(selected.id)}>담당 맡기</button>}</div></>}
    </section>
  </main>;
}
