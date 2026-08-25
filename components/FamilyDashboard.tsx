'use client';
import { useEffect, useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge';
import { StatusPill } from './StatusPill';
import { CareRequestCard } from './CareRequestCard';
import type { EmergencyEvent, ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { createRealtimeClient } from '@/lib/client/realtimeClientFactory';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';

async function fetchFamilyRequests(): Promise<ServiceRequest[]> {
  const response = await fetch('/api/care-cards');
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
  const [acknowledged, setAcknowledged] = useState(false);
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [consents, setConsents] = useState({ health: true, location: true, emergency: true, conversation: false });
  const realtime = useFamilyRealtime();
  const { requests } = useServiceRequestList({ realtime, fetchList: fetchFamilyRequests });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/emergencies');
        const body = await response.json();
        if (!cancelled) setEmergencies(Array.isArray(body.data) ? body.data : []);
      } catch { /* 마지막으로 받은 목록 유지 */ }
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const weekly = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = requests.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo);
    return { total: recent.length, unresolved: recent.filter((item) => item.status === 'new' || item.status === 'in_progress').length };
  }, [requests]);
  const latestRequest = requests[0];
  const latestEmergency = emergencies[0];

  const acknowledgeEmergency = async () => {
    if (!latestEmergency) return;
    try {
      await fetch(`/api/emergencies/${latestEmergency.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'family_acknowledged', action: '가족이 위기 알림을 확인했어요.' }),
      });
    } catch { /* 화면은 확인 동작을 유지하고 서버 재시도 대상으로 남긴다. */ }
    setAcknowledged(true);
  };

  return <main className="family-shell"><DemoBadge />
    <header className="app-header"><div><p className="eyebrow">돌봄이음 AI</p><h1>아버지의 오늘</h1></div><span className="avatar">이</span></header>
    {view === 'home' && <>
      {latestEmergency && <button className="alert-card" onClick={() => setView('emergency')}><StatusPill status={latestEmergency.status === 'detected' ? '긴급 · 미확인' : '긴급 · 확인됨'} /><strong>{latestEmergency.utterance}</strong><span>{new Date(latestEmergency.createdAt).toLocaleString('ko-KR')} · {latestEmergency.location} ›</span></button>}
      <section className="family-grid"><article><small>마지막 확인</small><strong>{latestRequest ? new Date(latestRequest.updatedAt).toLocaleString('ko-KR') : '기록 없음'}</strong><span>요청 카드 기준</span></article><article><small>오늘 상태</small><strong>{weekly.unresolved > 0 ? '도움 요청 확인 중' : '새 요청 없음'}</strong><span>요청 카드 기준</span></article></section>
      <section className="card"><div className="section-title"><h2>최근 7일 변화</h2></div><div className="week"><b>요청<br />{weekly.total}건</b><b>위기 알림<br />{emergencies.length}건</b><b>미처리<br />{weekly.unresolved}건</b></div></section>
      <section className="card ai-summary"><p className="ai-pill">🤖 AI 요약</p><h2>{latestRequest ? `이번 주에 ${latestRequest.summary}` : '이번 주에 등록된 요청이 없어요.'}</h2><p>말동무 대화 원문은 공유되지 않으며, 동의된 요청 요약만 보여요.</p></section>
      <section className="care-card-feed" aria-label="최근 돌봄 요청"><div className="section-title"><h2>최근 요청</h2><span>{requests.length}건</span></div>{requests.length === 0 ? <p className="notice">공유된 요청이 없어요.</p> : requests.map((item) => <CareRequestCard key={item.id} card={item} role="family" />)}</section>
    </>}
    {view === 'emergency' && latestEmergency && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><StatusPill status={acknowledged ? '가족 확인 완료' : '긴급 · 미확인'} /><h1>위기 알림 상세</h1><dl><dt>감지 시각</dt><dd>{new Date(latestEmergency.createdAt).toLocaleString('ko-KR')}</dd><dt>위치</dt><dd>{latestEmergency.location}</dd><dt>발화 원문</dt><dd>{latestEmergency.utterance}</dd><dt>위험도 근거</dt><dd>긴급 증상 고정 규칙이 감지되었어요.</dd></dl><div className="timeline"><b>처리 타임라인</b>{latestEmergency.actions.map((action) => <p key={`${action.at}-${action.action}`}>{new Date(action.at).toLocaleTimeString('ko-KR')} · {action.action}</p>)}</div><div className="actions"><a href="tel:119" className="danger">119 전화</a><button>노인에게 전화</button><button>사회복지사와 공유</button><button className="primary" onClick={acknowledgeEmergency}>확인 완료</button></div><p className="notice">실제 119 신고나 메시지 발신은 하지 않는 데모입니다.</p></section>}
    {view === 'consent' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><h1>동의·대리·결정 권한</h1><p>동의는 항목별로 언제든 철회할 수 있어요.</p>{Object.entries(consents).map(([key, value]) => <label className="toggle-row" key={key}><span>{({ health: '건강 요약', location: '위치 정보', emergency: '위기 정보', conversation: '대화 안부 요약' } as Record<string, string>)[key]}</span><input type="checkbox" checked={value} onChange={() => setConsents({ ...consents, [key]: !value })} /></label>)}</section>}
    <nav className="family-nav"><button onClick={() => setView('home')}>홈</button><button onClick={() => setView('consent')}>동의·권한</button></nav>
  </main>;
}
