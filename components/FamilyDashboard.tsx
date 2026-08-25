'use client';
import { useEffect, useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import type { ConsentGrant, ServiceRequestView as ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { useEmergencyList } from '@/lib/client/useEmergencyList';
import { emergencyStatusLabel } from '@/lib/domain/policies';
import { useSessionProfile } from '@/lib/client/useSessionProfile';
import { LogoutButton } from './LogoutButton';

async function fetchFamilyRequests(): Promise<ServiceRequest[]> {
  const response = await fetch('/api/care-cards');
  if (response.ok === false) throw new Error('가족 요청 목록 조회 실패');
  const body = await response.json();
  return Array.isArray(body?.data) ? body.data as ServiceRequest[] : [];
}

function useFamilyRealtime(): RealtimeClientPort {
  const [client] = useState(() => createRealtimeClient(fetchFamilyRequests));
  useEffect(() => () => client.dispose(), [client]);
  return client;
}

export function FamilyDashboard() {
  const [view, setView] = useState<'home' | 'emergency' | 'requests' | 'consent'>('home');
  const profile = useSessionProfile();
  const { emergencies } = useEmergencyList();
  const [consents, setConsents] = useState<ConsentGrant[]>([]);
  const realtime = useFamilyRealtime();
  const { requests, isLoading } = useServiceRequestList({ realtime, fetchList: fetchFamilyRequests });

  useEffect(() => {
    fetch('/api/consents').then(async (response) => {
      const body = await response.json();
      if (response.ok) setConsents(Array.isArray(body.data) ? body.data : []);
    }).catch(() => {});
  }, []);

  const weekly = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = requests.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo);
    return { total: recent.length, unresolved: recent.filter((item) => item.status === 'new' || item.status === 'in_progress').length };
  }, [requests]);
  const latestRequest = requests[0];
  const activeEmergency = emergencies.find((event) => event.status !== 'closed');
  const latestClosedEmergency = emergencies.find((event) => event.status === 'closed');
  const latestEmergency = activeEmergency ?? latestClosedEmergency;
  // 연결된 노인 이름은 서버가 카드에 붙여 준다. 아직 카드가 없으면 특정 호칭을 지어내지 않는다.
  const seniorName = requests.find((item) => item.seniorName)?.seniorName;

  return <main className="family-shell">
    <header className="app-header"><div><BrandLogo onClick={() => setView('home')} /><h1>{seniorName ? `${seniorName} 어르신의 오늘` : '오늘의 돌봄'}</h1></div><div className="session-actions"><span className="avatar">{profile?.displayName.slice(0, 1) ?? '가'}</span><LogoutButton className="header-logout" /></div></header>
    {view === 'home' && <>
      <section className="section-block" aria-labelledby="today-status-heading">
        <h2 id="today-status-heading" className="section-heading">오늘의 현황</h2>
        {activeEmergency && <button className="alert-card" onClick={() => setView('emergency')}><StatusPill status={emergencyStatusLabel(activeEmergency.status)} /><strong>{activeEmergency.utterance}</strong><span>{new Date(activeEmergency.createdAt).toLocaleString('ko-KR')} · {activeEmergency.location} ›</span></button>}
        <section className="family-grid"><article><small>마지막 확인</small><strong>{latestRequest ? new Date(latestRequest.updatedAt).toLocaleString('ko-KR') : '기록 없음'}</strong><span>요청 카드 기준</span></article><article><small>오늘 상태</small><strong>{weekly.unresolved > 0 ? '도움 요청 확인 중' : '새 요청 없음'}</strong><span>요청 카드 기준</span></article></section>
        <section className="card"><div className="section-title"><h2>최근 7일 변화</h2></div><div className="week"><b>요청<br />{weekly.total}건</b><b>위기 알림<br />{emergencies.length}건</b><b>미처리<br />{weekly.unresolved}건</b></div></section>
        <section className="card ai-summary"><p className="ai-pill">🤖 AI 요약</p><h2>{latestRequest ? `이번 주에 ${latestRequest.summary}` : '이번 주에 등록된 요청이 없어요.'}</h2><p>노인이 확인해 보낸 요청의 요약만 보여요. 원문은 담당 사회복지사만 확인할 수 있어요.</p></section>
        {!activeEmergency && latestClosedEmergency && <button className="resolved-history-row" onClick={() => setView('emergency')}><span><StatusPill status="긴급 종료됨" /> 어르신이 긴급 상황을 종료했어요.</span><span>이력 보기 ›</span></button>}
      </section>
      <section className="section-block care-card-feed" aria-label="최근 돌봄 요청">
        <div className="section-title"><h2 className="section-heading">최근 요청</h2><span>{requests.length}건</span></div>
        {isLoading && requests.length === 0 ? <p className="notice" role="status">요청을 불러오는 중이에요.</p> : requests.length === 0 ? <p className="notice">공유된 요청이 없어요.</p> : requests.slice(0, 3).map((item) => <CareRequestCard key={item.id} card={item} role="family" />)}
        {requests.length > 3 && <button className="secondary wide" onClick={() => setView('requests')}>전체 요청 {requests.length}건 보기</button>}
      </section>
    </>}
    {view === 'requests' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><h1>전체 돌봄 요청</h1><div className="care-card-feed">{requests.map((item) => <CareRequestCard key={item.id} card={item} role="family" />)}</div></section>}
    {view === 'emergency' && latestEmergency && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><StatusPill status={emergencyStatusLabel(latestEmergency.status)} /><h1>위기 알림 상세</h1>{latestEmergency.status === 'closed' && <p className="notice">어르신이 긴급 상황을 종료했어요. 기록은 안전을 위해 보존돼요.</p>}<dl><dt>감지 시각</dt><dd>{new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</dd><dt>위치</dt><dd>{latestEmergency.location}</dd><dt>발화 원문</dt><dd>{latestEmergency.utterance}</dd><dt>위험도 근거</dt><dd>긴급 증상 고정 규칙이 감지되었어요.</dd></dl><div className="timeline"><b>처리 타임라인</b>{latestEmergency.actions.map((action) => <p key={`${action.at}-${action.action}`}>{new Date(action.at).toLocaleTimeString('ko-KR')} · {action.action}</p>)}</div><div className="actions"><a href="tel:119" className="danger">119 전화</a><button>노인에게 전화</button><button>사회복지사와 공유</button></div><p className="notice">부양가족 계정은 연결된 노인의 현황을 열람만 할 수 있어요.</p></section>}
    {view === 'consent' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><h1>동의·대리·결정 권한</h1><p>정보 공유 여부는 어르신이 결정하며, 부양가족 계정에서는 현재 상태만 확인할 수 있어요.</p>{(['health', 'location', 'emergency', 'service'] as const).map((scope) => { const grant = consents.find((item) => item.scope === scope && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now()); const label = { health: '건강 요약', location: '위치 정보', emergency: '위기 정보', service: '돌봄 요청' }[scope]; return <div className="toggle-row consent-readonly" key={scope}><span>{label}</span><StatusPill status={grant ? '어르신이 허용함' : '허용되지 않음'} />{grant && <small>{new Date(grant.expiresAt).toLocaleDateString('ko-KR')}까지</small>}</div>; })}</section>}
    <nav className="family-nav"><button onClick={() => setView('home')}>홈</button><button onClick={() => setView('consent')}>동의·권한</button></nav>
  </main>;
}
