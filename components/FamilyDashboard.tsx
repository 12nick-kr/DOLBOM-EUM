'use client';
import { useEffect, useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import type { ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';
import { useEmergencyList } from '@/lib/client/useEmergencyList';
import { emergencyStatusLabel } from '@/lib/domain/policies';

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
  const [view, setView] = useState<'home' | 'emergency' | 'consent'>('home');
  const { emergencies } = useEmergencyList();
  const [consents, setConsents] = useState({ health: true, location: true, emergency: true });
  const realtime = useFamilyRealtime();
  const { requests, isLoading } = useServiceRequestList({ realtime, fetchList: fetchFamilyRequests });

  const weekly = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = requests.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo);
    return { total: recent.length, unresolved: recent.filter((item) => item.status === 'new' || item.status === 'in_progress').length };
  }, [requests]);
  const latestRequest = requests[0];
  const latestEmergency = emergencies[0];

  return <main className="family-shell"><DemoBadge />
    <header className="app-header"><div><p className="eyebrow">돌봄이음 AI</p><h1>아버지의 오늘</h1></div><span className="avatar">이</span></header>
    {view === 'home' && <>
      {latestEmergency && <button className={`alert-card ${latestEmergency.status === 'closed' ? 'resolved-alert-card' : ''}`} onClick={() => setView('emergency')}><StatusPill status={emergencyStatusLabel(latestEmergency.status)} /><strong>{latestEmergency.status === 'closed' ? '어르신이 긴급 상황을 종료했어요.' : latestEmergency.utterance}</strong><span>{new Date(latestEmergency.createdAt).toLocaleString('ko-KR')} · {latestEmergency.location} ›</span></button>}
      <section className="family-grid"><article><small>마지막 확인</small><strong>{latestRequest ? new Date(latestRequest.updatedAt).toLocaleString('ko-KR') : '기록 없음'}</strong><span>요청 카드 기준</span></article><article><small>오늘 상태</small><strong>{weekly.unresolved > 0 ? '도움 요청 확인 중' : '새 요청 없음'}</strong><span>요청 카드 기준</span></article></section>
      <section className="card"><div className="section-title"><h2>최근 7일 변화</h2></div><div className="week"><b>요청<br />{weekly.total}건</b><b>위기 알림<br />{emergencies.length}건</b><b>미처리<br />{weekly.unresolved}건</b></div></section>
      <section className="card ai-summary"><p className="ai-pill">🤖 AI 요약</p><h2>{latestRequest ? `이번 주에 ${latestRequest.summary}` : '이번 주에 등록된 요청이 없어요.'}</h2><p>노인이 확인해 보낸 요청의 요약만 보여요. 원문은 담당 사회복지사만 확인할 수 있어요.</p></section>
      <section className="care-card-feed" aria-label="최근 돌봄 요청"><div className="section-title"><h2>최근 요청</h2><span>{requests.length}건</span></div>{isLoading ? <p className="notice" role="status">요청을 불러오는 중이에요.</p> : requests.length === 0 ? <p className="notice">공유된 요청이 없어요.</p> : requests.map((item) => <CareRequestCard key={item.id} card={item} role="family" />)}</section>
    </>}
    {view === 'emergency' && latestEmergency && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><StatusPill status={emergencyStatusLabel(latestEmergency.status)} /><h1>위기 알림 상세</h1>{latestEmergency.status === 'closed' && <p className="notice">어르신이 긴급 상황을 종료했어요. 기록은 안전을 위해 보존돼요.</p>}<dl><dt>감지 시각</dt><dd>{new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</dd><dt>위치</dt><dd>{latestEmergency.location}</dd><dt>발화 원문</dt><dd>{latestEmergency.utterance}</dd><dt>위험도 근거</dt><dd>긴급 증상 고정 규칙이 감지되었어요.</dd></dl><div className="timeline"><b>처리 타임라인</b>{latestEmergency.actions.map((action) => <p key={`${action.at}-${action.action}`}>{new Date(action.at).toLocaleTimeString('ko-KR')} · {action.action}</p>)}</div><div className="actions"><a href="tel:119" className="danger">119 전화</a><button>노인에게 전화</button><button>사회복지사와 공유</button></div><p className="notice">부양가족 계정은 연결된 노인의 현황을 열람만 할 수 있어요.</p></section>}
    {view === 'consent' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><h1>동의·대리·결정 권한</h1><p>동의는 항목별로 언제든 철회할 수 있어요.</p>{Object.entries(consents).map(([key, value]) => <label className="toggle-row" key={key}><span>{({ health: '건강 요약', location: '위치 정보', emergency: '위기 정보' } as Record<string, string>)[key]}</span><input type="checkbox" checked={value} onChange={() => setConsents({ ...consents, [key]: !value })} /></label>)}</section>}
    <nav className="family-nav"><button onClick={() => setView('home')}>홈</button><button onClick={() => setView('consent')}>동의·권한</button></nav>
  </main>;
}
