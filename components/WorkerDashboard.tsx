'use client';
import { useEffect, useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import { requestTypeLabel, statusLabelFor } from '@/lib/domain/policies';
import type { EmergencyEvent, ServiceRequestView as ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { useEmergencyList } from '@/lib/client/useEmergencyList';
import { CareConnectionManager } from './CareConnectionManager';
import { LogoutButton } from './LogoutButton';
import { scheduleStateFor, scheduleStateLabel, type RequestScheduleState } from '@/lib/domain/requestSchedule';
import { useSessionProfile } from '@/lib/client/useSessionProfile';
import type { CareGroupSummary } from '@/lib/server/careRelationshipRepository';

async function fetchServiceRequests(): Promise<ServiceRequest[]> { const response = await fetch('/api/care-cards'); if (response.ok === false) throw new Error('요청 목록 조회 실패'); const body = await response.json(); return Array.isArray(body.data) ? body.data : []; }
function useWorkerRealtime(): RealtimeClientPort { const [client] = useState(() => createRealtimeClient(fetchServiceRequests)); useEffect(() => () => client.dispose(), [client]); return client; }

type StatFilter = 'emergency' | 'unread' | 'new' | 'in_progress' | 'done';
const statFilterLabel: Record<StatFilter, string> = { emergency: '미확인 긴급 알림', unread: '미확인 요청', new: '새 요청', in_progress: '처리 중 요청', done: '완료 요청' };

export function WorkerDashboard() {
  const [page, setPage] = useState<'dashboard' | 'inbox' | 'case' | 'request' | 'management'>('dashboard');
  const profile = useSessionProfile();
  const [filter, setFilter] = useState('전체');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | RequestScheduleState>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statModalFilter, setStatModalFilter] = useState<StatFilter | null>(null);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);
  const { emergencies, removeEmergencyOptimistically, restoreEmergency } = useEmergencyList();
  const [deleteEmergencyTarget, setDeleteEmergencyTarget] = useState<EmergencyEvent | null>(null);
  const [deletingEmergencyId, setDeletingEmergencyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [careGroups, setCareGroups] = useState<CareGroupSummary[]>([]);
  const realtime = useWorkerRealtime();
  const { requests, connectionState, unreadCount, isUnread, acknowledge, refetch, isLoading, removeOptimistically, restore, upsertOptimistically } = useServiceRequestList({ realtime, fetchList: fetchServiceRequests });

  useEffect(() => {
    fetch('/api/care-management/groups').then(async (response) => {
      const body = await response.json();
      if (response.ok) setCareGroups(Array.isArray(body.data) ? body.data : []);
    }).catch(() => {});
  }, []);

  // 담당 노인이 여러 명일 수 있으므로 카드에 실제로 붙어 온 이름을 쓰고, 아직 없으면 중립 문구로 둔다.
  const primaryGroup = careGroups[0];
  const primarySeniorName = primaryGroup?.senior.displayName ?? requests.find((item) => item.seniorName)?.seniorName ?? '담당';

  const filtered = useMemo(() => requests.filter((item) => (filter === '전체' || (filter === '신규' && item.status === 'new') || (filter === '진행중' && item.status === 'in_progress') || (filter === '완료' && item.status === 'done')) && (scheduleFilter === 'all' || (item.status !== 'done' && scheduleStateFor(item) === scheduleFilter))), [requests, filter, scheduleFilter]);
  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const activeEmergencies = emergencies.filter((event) => event.status !== 'closed');
  const latestEmergency = activeEmergencies[0] ?? null;
  const openRequest = (id: string) => {
    setSelectedId(id);
    acknowledge(id);
    setIsEditingMemo(false);
    setPage('request');
    void fetch(`/api/service-requests/${id}/read`, { method: 'POST' })
      .then(async (response) => {
        if (response.ok) upsertOptimistically(await response.json());
        else await refetch();
      })
      .catch(() => refetch());
  };
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
  const startEditingMemo = (currentMemo: string) => { setMemoDraft(currentMemo); setIsEditingMemo(true); };
  const saveMemo = async (id: string) => {
    if (savingMemo) return;
    setSavingMemo(true);
    try {
      const response = await fetch(`/api/service-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo: memoDraft }) });
      if (!response.ok) return;
      upsertOptimistically(await response.json());
      setIsEditingMemo(false);
    } finally { setSavingMemo(false); }
  };
  const reviewRisk = async (id: string) => {
    const response = await fetch(`/api/service-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ riskReviewed: true }) });
    if (response.ok) upsertOptimistically(await response.json());
  };
  /** 인박스 카드·통계 모달이 함께 쓰는 상태 변경 2버튼. 현재 상태에 맞는 다음 전이 버튼만 활성화한다. */
  const statusActions = (request: ServiceRequest) => request.status === 'done' || request.status === 'rejected' ? null : (
    <div className="status-actions">
      {request.status === 'new' && <button className="status-action" onClick={() => takeCharge(request.id)}>진행중으로 변경</button>}
      {request.status === 'in_progress' && <button className="status-action" onClick={() => completeRequest(request.id)}>완료 처리</button>}
    </div>
  );
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
  const confirmEmergencyDelete = async () => {
    if (!deleteEmergencyTarget || deletingEmergencyId) return;
    const target = deleteEmergencyTarget;
    setDeleteEmergencyTarget(null);
    setDeletingEmergencyId(target.id);
    removeEmergencyOptimistically(target.id);
    try {
      const response = await fetch(`/api/emergencies/${target.id}`, { method: 'DELETE' });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || '긴급 알림을 삭제하지 못했어요.'); }
    } catch (error) {
      restoreEmergency(target);
      setDeleteError(error instanceof Error ? error.message : '긴급 알림을 삭제하지 못했어요.');
    } finally { setDeletingEmergencyId(null); }
  };

  return <main className="worker-layout">
    <aside><BrandLogo className="sidebar-logo" onClick={() => setPage('dashboard')} /><nav><button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ 대시보드</button><button className={page === 'inbox' || page === 'request' ? 'active' : ''} onClick={() => setPage('inbox')}>☷ 요청 업무함</button><button className={page === 'case' ? 'active' : ''} onClick={() => setPage('case')}>◉ 사례 관리</button><button className={page === 'management' ? 'active' : ''} onClick={() => setPage('management')}>⌘ 연결 관리</button></nav><div className="institution"><span className="avatar">{profile?.displayName.slice(0, 1) ?? '담'}</span><div><b>충남 돌봄복지관</b><span>사회복지사 계정</span><LogoutButton className="sidebar-logout" /></div></div></aside>
    <section className="worker-content">
      {connectionState === 'disconnected' && <p className="notice" role="status">실시간 연결이 끊겼어요. 마지막 목록을 유지하며 재연결 중이에요.</p>}
      {deleteError && <p className="notice error-notice" role="alert">{deleteError}</p>}
      {page === 'dashboard' && <><header className="worker-header"><div><p className="eyebrow">담당 현황</p><h1>{profile ? `좋은 아침이에요, ${profile.displayName}님` : '좋은 아침이에요'}</h1></div><span className="avatar">{profile?.displayName.slice(0, 1) ?? '담'}</span></header><div className="stats"><button className="stat-card" onClick={() => setStatModalFilter('emergency')}><StatusPill status="긴급" /><strong>{emergencies.filter((event) => event.status === 'detected').length}</strong><span>미확인 긴급 알림</span></button><button className="stat-card" onClick={() => setStatModalFilter('unread')}><StatusPill status="미확인" /><strong>{unreadCount}</strong><span>아직 열지 않은 요청</span></button><button className="stat-card" onClick={() => setStatModalFilter('new')}><StatusPill status="신규" /><strong>{requests.filter((request) => request.status === 'new').length}</strong><span>새 요청</span></button><button className="stat-card" onClick={() => setStatModalFilter('in_progress')}><StatusPill status="진행중" /><strong>{requests.filter((request) => request.status === 'in_progress').length}</strong><span>처리 중 요청</span></button><button className="stat-card" onClick={() => setStatModalFilter('done')}><StatusPill status="완료" /><strong>{requests.filter((request) => request.status === 'done').length}</strong><span>완료 요청</span></button></div>{latestEmergency && <button className="worker-emergency" onClick={() => setPage('case')}><StatusPill status={latestEmergency.status === 'detected' ? '긴급 · 미확인' : '긴급 · 확인됨'} /><div><strong>{primarySeniorName} 어르신 · {latestEmergency.utterance}</strong><p>{latestEmergency.location}</p></div><span>자세히 보기 ›</span></button>}<div className="worker-columns"><section className="card worker-info-card"><h2>최근 요청</h2><p>{requests[0]?.summary ?? '새 요청이 없어요.'}</p></section><section className="card worker-info-card"><h2>오늘 할 일</h2><ol>{requests.filter((request) => request.status !== 'done' && scheduleStateFor(request) === 'today').slice(0, 3).map((request) => <li key={request.id}>{request.summary}</li>)}{requests.filter((request) => request.status !== 'done' && scheduleStateFor(request) === 'today').length === 0 && <li>오늘 일정의 미처리 요청이 없어요.</li>}</ol></section></div><section className="card"><h2>담당 노인</h2><button className="list-row" onClick={() => setPage('case')}><b>{primarySeniorName}</b><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : requests.some((request) => request.status === 'new') ? '신규 요청' : '안정'} /><span>미처리 {requests.filter((request) => request.status !== 'done').length}건 · 활성 긴급 {activeEmergencies.length}건 · 긴급 이력 {emergencies.length}건</span></button></section></>}
      {page === 'inbox' && <><header className="worker-header"><h1>요청 업무함</h1><span className="pill blue" aria-live="polite">미확인 {unreadCount}건</span></header><div className="filter-tabs">{['전체', '신규', '진행중', '완료'].map((item) => <button onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''} key={item}>{item}</button>)}</div><div className="filter-tabs schedule-tabs" aria-label="희망 일정 필터"><button onClick={() => setScheduleFilter('all')} className={scheduleFilter === 'all' ? 'selected' : ''}>모든 일정</button>{(Object.keys(scheduleStateLabel) as RequestScheduleState[]).map((item) => <button onClick={() => setScheduleFilter(item)} className={scheduleFilter === item ? 'selected' : ''} key={item}>{scheduleStateLabel[item]}</button>)}</div><div className="care-card-feed">{isLoading && requests.length === 0 && <p className="notice" role="status">요청을 불러오는 중이에요.</p>}{!isLoading && filtered.length === 0 && <p className="notice">조건에 맞는 요청이 없어요.</p>}{filtered.map((item) => <CareRequestCard card={item} role="worker" unread={isUnread(item.id)} key={item.id} onSelect={() => openRequest(item.id)} onDelete={askDelete} deleting={deletingId === item.id} actions={statusActions(item)} />)}</div></>}
      {page === 'case' && <><button className="back" onClick={() => setPage('dashboard')}>‹ 대시보드</button><header className="case-header"><div className="profile">{primarySeniorName.slice(0, 1)}</div><div><StatusPill status={latestEmergency?.status === 'detected' ? '긴급' : '담당 사례'} /><h1>{primarySeniorName} 어르신</h1><p>담당: {profile?.displayName ?? '담당 사회복지사'} · 요청 {requests.length}건</p></div></header>{careGroups.length === 0 && <p className="notice error-notice">연결 관리 정보가 요청 범위와 일치하지 않아요. 연결 관리에서 담당 관계를 확인해 주세요.</p>}<div className="case-grid"><section className="card"><h2>현재 업무</h2><p>미처리 {requests.filter((item) => item.status !== 'done').length}건 · 오늘 {requests.filter((item) => item.status !== 'done' && scheduleStateFor(item) === 'today').length}건</p></section><section className="card"><h2>돌봄 연결</h2><p>부양가족 {primaryGroup?.family.map((member) => member.displayName).join(', ') || '연결 없음'}</p><p>사회복지사 {primaryGroup?.workers.map((worker) => worker.displayName).join(', ') || profile?.displayName || '연결 확인 필요'}</p></section><section className="card"><h2>안전 현황</h2><p>활성 긴급 {activeEmergencies.length}건 · 긴급 이력 {emergencies.length}건</p><p>안전 확인 요청 {requests.filter((item) => item.riskLevel === 'attention' || item.riskLevel === 'emergency').length}건</p></section></div>{latestEmergency && <section className="card worker-emergency-detail"><div><h2>최근 긴급 현황</h2><button className="danger" disabled={deletingEmergencyId === latestEmergency.id} onClick={() => { setDeleteError(''); setDeleteEmergencyTarget(latestEmergency); }}>긴급 알림 해제 및 삭제</button></div><p>{latestEmergency.utterance}</p><p>{latestEmergency.location} · {new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</p></section>}<section className="care-card-feed">{requests.map((item) => <CareRequestCard card={item} role="worker" key={item.id} onSelect={() => openRequest(item.id)} onDelete={askDelete} deleting={deletingId === item.id} />)}</section></>}
      {page === 'request' && selected && <><button className="back" onClick={() => setPage('inbox')}>‹ 요청 업무함</button><header className="worker-header"><div><StatusPill status={statusLabelFor('worker', selected.status)} /><h1>{requestTypeLabel[selected.type]}</h1></div></header>{(selected.riskLevel === 'attention' || selected.riskLevel === 'emergency') && <section className={`worker-risk-alert${selected.riskReviewedAt ? ' reviewed' : ''}`} role="alert"><StatusPill status={selected.riskReviewedAt ? '안전 확인 완료' : selected.riskLevel === 'emergency' ? '긴급 확인 필요' : '안전 확인 필요'} /><strong>{selected.riskReasons?.join(', ') || '원문을 직접 확인해 주세요.'}</strong><p>{selected.riskReviewedAt ? `${new Date(selected.riskReviewedAt).toLocaleString('ko-KR')}에 확인했어요.` : '안전 확인 전에는 일반 업무로만 판단하지 마세요.'}</p>{!selected.riskReviewedAt && <button className="danger" onClick={() => reviewRisk(selected.id)}>안전 확인 완료</button>}</section>}<CareRequestCard card={selected} role="worker" onDelete={askDelete} deleting={deletingId === selected.id} /><section className="request-detail"><div className="card"><p className="ai-pill">AI 신청 초안</p><h2>{requestTypeLabel[selected.type]} 연계 검토</h2><p>{selected.details.destination ? `${selected.details.destination} 관련 지원 조건을 확인해 주세요.` : '대상 조건과 실제 지원 가능 여부는 담당자가 확인해야 해요.'}</p></div><div className="card request-timeline"><h2>처리 이력</h2><p>생성 · {new Date(selected.createdAt).toLocaleString('ko-KR')}</p><p>{selected.acknowledgedAt ? `확인 · ${new Date(selected.acknowledgedAt).toLocaleString('ko-KR')}` : '아직 서버 확인 기록이 없어요.'}</p>{selected.completedAt && <p>완료 · {new Date(selected.completedAt).toLocaleString('ko-KR')}</p>}</div><div className="memo"><div className="memo-header"><span>담당자 메모</span>{isEditingMemo ? <button className="secondary" disabled={savingMemo} onClick={() => saveMemo(selected.id)}>{savingMemo ? '저장 중' : '저장'}</button> : <button className="secondary" onClick={() => startEditingMemo(selected.memo ?? '')}>수정</button>}</div>{isEditingMemo ? <textarea value={memoDraft} onChange={(event) => setMemoDraft(event.target.value)} maxLength={500} placeholder="확인한 사실만 기록해 주세요." /> : <p className="memo-readonly">{selected.memo || '아직 작성된 메모가 없어요.'}</p>}</div></section>{statusActions(selected)}</>}
      {page === 'management' && <CareConnectionManager />}
    </section>
    {statModalFilter && <div className="modal-backdrop" role="presentation" onClick={() => setStatModalFilter(null)}><section className="confirm-dialog stat-modal" role="dialog" aria-modal="true" aria-labelledby="stat-modal-title" onClick={(event) => event.stopPropagation()}><div className="stat-modal-header"><h2 id="stat-modal-title">{statFilterLabel[statModalFilter]}</h2><button className="stat-modal-close" aria-label="닫기" onClick={() => setStatModalFilter(null)}>✕</button></div><div className="care-card-feed">
      {statModalFilter === 'emergency'
        ? (emergencies.filter((event) => event.status === 'detected').length === 0
          ? <p className="notice">미확인 긴급 알림이 없어요.</p>
          : emergencies.filter((event) => event.status === 'detected').map((event) => <div className="list-row" key={event.id}><b>{primarySeniorName} 어르신</b><StatusPill status="긴급 · 미확인" /><span>{event.location} · {new Date(event.createdAt).toLocaleString('ko-KR')}</span></div>))
        : ((statModalFilter === 'unread' ? requests.filter((request) => isUnread(request.id)) : requests.filter((request) => request.status === statModalFilter)).length === 0
          ? <p className="notice">해당하는 요청이 없어요.</p>
          : (statModalFilter === 'unread' ? requests.filter((request) => isUnread(request.id)) : requests.filter((request) => request.status === statModalFilter)).map((item) => <CareRequestCard card={item} role="worker" unread={isUnread(item.id)} key={item.id} onSelect={() => { setStatModalFilter(null); openRequest(item.id); }} actions={statusActions(item)} />))}
    </div></section></div>}
    {deleteTarget && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-request-title"><h2 id="delete-request-title">이 요청을 삭제할까요?</h2><p>{deleteTarget.summary}</p><p className="notice">서버의 요청 카드와 연결된 노인 입력 JSON이 함께 삭제돼요.</p><div className="confirm-actions"><button onClick={() => setDeleteTarget(null)}>취소</button><button className="danger" onClick={confirmDelete}>삭제</button></div></section></div>}
    {deleteEmergencyTarget && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-emergency-title"><h2 id="delete-emergency-title">긴급 알림을 해제하고 삭제할까요?</h2><p>{deleteEmergencyTarget.utterance}</p><p className="notice">서버의 긴급 원문·위치 정보와 연결된 노인 입력 JSON이 함께 삭제되며 복구할 수 없어요.</p><div className="confirm-actions"><button onClick={() => setDeleteEmergencyTarget(null)}>취소</button><button className="danger" onClick={confirmEmergencyDelete}>해제 및 삭제</button></div></section></div>}
  </main>;
}
