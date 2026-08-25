'use client';
import { useEffect, useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import { statusLabelFor } from '@/lib/domain/policies';
import type { ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { useEmergencyList } from '@/lib/client/useEmergencyList';
import { CareConnectionManager } from './CareConnectionManager';
import { LogoutButton } from './LogoutButton';
import { scheduleStateFor, scheduleStateLabel, type RequestScheduleState } from '@/lib/domain/requestSchedule';

const typeLabel: Record<ServiceRequest['type'], string> = { hospital_escort: '병원동행 요청', welfare_info: '복지 정보 안내', daily_help: '일상 도움 요청' };
async function fetchServiceRequests(): Promise<ServiceRequest[]> { const response = await fetch('/api/care-cards'); if (response.ok === false) throw new Error('요청 목록 조회 실패'); const body = await response.json(); return Array.isArray(body.data) ? body.data : []; }
function useWorkerRealtime(): RealtimeClientPort { const [client] = useState(() => createRealtimeClient(fetchServiceRequests)); useEffect(() => () => client.dispose(), [client]); return client; }

export function WorkerDashboard() {
  const [page, setPage] = useState<'dashboard' | 'inbox' | 'case' | 'request' | 'management'>('dashboard');
  const [filter, setFilter] = useState('전체');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | RequestScheduleState>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { emergencies } = useEmergencyList();
  const [deleteTarget, setDeleteTarget] = useState<ServiceRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const realtime = useWorkerRealtime();
  const { requests, connectionState, unreadCount, isUnread, acknowledge, isLoading, removeOptimistically, restore, upsertOptimistically } = useServiceRequestList({ realtime, fetchList: fetchServiceRequests });

  const filtered = useMemo(() => requests.filter((item) => (filter === '전체' || (filter === '신규' && item.status === 'new') || (filter === '진행중' && item.status === 'in_progress') || (filter === '완료' && item.status === 'done')) && (scheduleFilter === 'all' || (item.status !== 'done' && scheduleStateFor(item) === scheduleFilter))), [requests, filter, scheduleFilter]);
  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const latestEmergency = emergencies.find((event) => event.status !== 'closed') ?? null;
  const openRequest = (id: string) => { setSelectedId(id); acknowledge(id); setPage('request'); };
  const takeCharge = async (id: string) => {
    const response = await fetch(`/api/service-requests/${id}/take-charge`, { method: 'POST' });
    if (!response.ok) return;
    upsertOptimistically(await response.json());
  };
  const completeRequest = async (id: string) => {
    const response = await fetch(`/api/service-requests/${id}/complete`, { method: 'POST' });
    if (!response.ok) return;
    upsertOptimistically(await response.json());
  };
  const askDelete = (id: string) => { const target = requests.find((item) => item.id === id); if (target) { setDeleteError(''); setDeleteTarget(target); } };
  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    const target = deleteTarget;
    setDeletingId(target.id);
    setDeleteTarget(null);
    const removed = removeOptimistically(target.id);
    if (selectedId === target.id) { setSelectedId(null); setPage('inbox'); }
    try {
      const response = await fetch(`/api/service-requests/${target.id}`, { method: 'DELETE' });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || '요청을 삭제하지 못했어요.'); }
    } catch (error) {
      if (removed) restore(removed);
      setDeleteError(error instanceof Error ? error.message : '요청을 삭제하지 못했어요.');
    } finally { setDeletingId(null); }
  };

  return <main className="worker-layout">
    <aside><div className="brand">돌봄이음 <em>AI</em></div><nav><button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ 대시보드</button><button className={page === 'inbox' || page === 'request' ? 'active' : ''} onClick={() => setPage('inbox')}>☷ 요청 업무함</button><button className={page === 'case' ? 'active' : ''} onClick={() => setPage('case')}>◉ 사례 관리</button><button className={page === 'management' ? 'active' : ''} onClick={() => setPage('management')}>⌘ 연결 관리</button></nav><div className="institution"><b>충남 돌봄복지관</b><span>사회복지사 계정</span><LogoutButton className="sidebar-logout" /></div></aside>
    <section className="worker-content"><DemoBadge />
      {connectionState === 'disconnected' && <p className="notice" role="status">실시간 연결이 끊겼어요. 마지막 목록을 유지하며 재연결 중이에요.</p>}
      {deleteError && <p className="notice error-notice" role="alert">{deleteError}</p>}
      {page === 'dashboard' && <><header className="worker-header"><div><p className="eyebrow">담당 현황</p><h1>좋은 아침이에요, 박사회복지사님</h1></div><span className="avatar">박</span></header><div className="stats"><article><StatusPill status="긴급" /><strong>{emergencies.filter((event) => event.status === 'detected').length}</strong><span>미확인 긴급 알림</span></article><article><StatusPill status="신규" /><strong>{requests.filter((request) => request.status === 'new').length}</strong><span>새 요청</span></article><article><StatusPill status="진행중" /><strong>{requests.filter((request) => request.status === 'in_progress').length}</strong><span>처리 중 요청</span></article><article><StatusPill status="완료" /><strong>{requests.filter((request) => request.status === 'done').length}</strong><span>완료 요청</span></article></div>{latestEmergency && <button className="worker-emergency" onClick={() => setPage('case')}><StatusPill status={latestEmergency.status === 'detected' ? '긴급 · 미확인' : '긴급 · 확인됨'} /><div><strong>김순자 어르신 · {latestEmergency.utterance}</strong><p>{latestEmergency.location}</p></div><span>자세히 보기 ›</span></button>}<div className="worker-columns"><section className="card"><h2>최근 요청</h2><p>{requests[0]?.summary ?? '새 요청이 없어요.'}</p></section><section className="card"><h2>오늘 할 일</h2><ol>{requests.filter((request) => request.status !== 'done' && scheduleStateFor(request) === 'today').slice(0, 3).map((request) => <li key={request.id}>{request.summary}</li>)}{requests.filter((request) => request.status !== 'done' && scheduleStateFor(request) === 'today').length === 0 && <li>오늘 일정의 미처리 요청이 없어요.</li>}</ol></section></div><section className="card"><h2>담당 노인</h2><button className="list-row" onClick={() => setPage('case')}><b>김순자</b><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : requests.some((request) => request.status === 'new') ? '신규 요청' : '안정'} /><span>요청 {requests.length}건 · 긴급 {emergencies.length}건</span></button></section></>}
      {page === 'inbox' && <><header className="worker-header"><h1>요청 업무함</h1><span className="pill blue" aria-live="polite">신규 {unreadCount}건</span></header><div className="filter-tabs">{['전체', '신규', '진행중', '완료'].map((item) => <button onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''} key={item}>{item}</button>)}</div><div className="filter-tabs schedule-tabs" aria-label="희망 일정 필터"><button onClick={() => setScheduleFilter('all')} className={scheduleFilter === 'all' ? 'selected' : ''}>모든 일정</button>{(Object.keys(scheduleStateLabel) as RequestScheduleState[]).map((item) => <button onClick={() => setScheduleFilter(item)} className={scheduleFilter === item ? 'selected' : ''} key={item}>{scheduleStateLabel[item]}</button>)}</div><div className="care-card-feed">{isLoading && <p className="notice" role="status">요청을 불러오는 중이에요.</p>}{!isLoading && filtered.length === 0 && <p className="notice">조건에 맞는 요청이 없어요.</p>}{filtered.map((item) => <CareRequestCard card={item} role="worker" unread={isUnread(item.id)} key={item.id} onSelect={() => openRequest(item.id)} onDelete={askDelete} deleting={deletingId === item.id} />)}</div></>}
      {page === 'case' && <><button className="back" onClick={() => setPage('dashboard')}>‹ 대시보드</button><header className="case-header"><div className="profile">김</div><div><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : '담당 사례'} /><h1>김순자 어르신</h1><p>담당: 박사회복지사 · 요청 {requests.length}건</p></div></header>{latestEmergency && <section className="card"><h2>최근 긴급 현황</h2><p>{latestEmergency.utterance}</p><p>{latestEmergency.location} · {new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</p></section>}<section className="care-card-feed">{requests.map((item) => <CareRequestCard card={item} role="worker" key={item.id} onSelect={() => openRequest(item.id)} onDelete={askDelete} deleting={deletingId === item.id} />)}</section></>}
      {page === 'request' && selected && <><button className="back" onClick={() => setPage('inbox')}>‹ 요청 업무함</button><header className="worker-header"><div><StatusPill status={statusLabelFor('worker', selected.status)} /><h1>{typeLabel[selected.type]}</h1></div></header><CareRequestCard card={selected} role="worker" onDelete={askDelete} deleting={deletingId === selected.id} /><section className="request-detail"><div className="card"><p className="ai-pill">🤖 AI 신청 초안</p><h2>노인맞춤돌봄서비스 연계 검토</h2><p>대상 조건은 담당자가 확인해야 해요.</p></div><label className="memo"><span>담당자 메모</span><textarea placeholder="확인한 사실만 기록해 주세요." /></label></section><div className="case-actions"><button>정보 확인 요청</button>{selected.status === 'new' && <button className="primary" onClick={() => takeCharge(selected.id)}>담당 맡기</button>}{selected.status === 'in_progress' && <button className="primary" onClick={() => completeRequest(selected.id)}>처리 완료</button>}</div></>}
      {page === 'management' && <CareConnectionManager />}
    </section>
    {deleteTarget && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-request-title"><h2 id="delete-request-title">이 요청을 삭제할까요?</h2><p>{deleteTarget.summary}</p><p className="notice">서버의 요청 카드와 연결된 노인 입력 JSON이 함께 삭제돼요.</p><div className="confirm-actions"><button onClick={() => setDeleteTarget(null)}>취소</button><button className="danger" onClick={confirmDelete}>삭제</button></div></section></div>}
  </main>;
}
