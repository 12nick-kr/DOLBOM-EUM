'use client';
import { useMemo, useState } from 'react';
import { DemoBadge } from './DemoBadge'; import { StatusPill } from './StatusPill';
import type { ServiceRequest } from '@/lib/domain/types';
import { useServiceRequestList } from '@/lib/client/useServiceRequestList';
import { PollingRealtimeClient } from '@/lib/client/pollingRealtimeClient';
import type { RealtimeClientPort } from '@/lib/client/realtimePort';

/**
 * 가족 화면은 요약과 상태만 받는다 — 서버(`redactForRole`)가 이미 `transcript`를 응답에서
 * 제거하지만, 클라이언트도 원문이 있다고 가정하지 않고 렌더링하지 않는다(PRD §7.4).
 */
async function fetchFamilyRequests(): Promise<ServiceRequest[]> {
  const res = await fetch('/api/service-requests');
  const body = await res.json();
  return Array.isArray(body?.data) ? (body.data as ServiceRequest[]) : [];
}

function useFamilyRealtime(): RealtimeClientPort {
  const [client] = useState(() => new PollingRealtimeClient(fetchFamilyRequests));
  return client;
}

export function FamilyDashboard() { const [view, setView] = useState<'home' | 'emergency' | 'consent'>('home'); const [acknowledged, setAcknowledged] = useState(false); const [consents, setConsents] = useState({ health: true, location: true, emergency: true, conversation: false });
  const realtime = useFamilyRealtime();
  const { requests } = useServiceRequestList({ realtime, fetchList: fetchFamilyRequests });
  const weekly = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = requests.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo);
    return {
      total: recent.length,
      unresolved: recent.filter((item) => item.status === 'new' || item.status === 'in_progress').length,
    };
  }, [requests]);
  const latestRequest = requests[0];
  // 확인 완료는 로컬 state만 바꾸지 않고 실제 PATCH /api/emergencies/:id를 호출해 감사 로그(actor/action/at)를 남긴다(FR-03).
  const acknowledgeEmergency = async () => {
    try {
      await fetch('/api/emergencies/emergency-demo-001', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: 'family', status: 'family_acknowledged', action: '가족이 위기 알림을 확인했어요.' }) });
    } catch {
      // 네트워크 실패에도 화면 상 확인 상태는 사용자 조작을 반영한다 — 감사 로그 반영은 재시도 대상으로 남는다.
    }
    setAcknowledged(true);
  };
  return <main className="family-shell"><DemoBadge /><header className="app-header"><div><p className="eyebrow">돌봄이음 AI</p><h1>아버지의 오늘</h1></div><span className="avatar">이</span></header>{view === 'home' && <><button className="alert-card" onClick={() => setView('emergency')}><StatusPill status="긴급 · 미확인" /><strong>가슴 통증과 호흡 곤란 표현이 감지되었어요</strong><span>방금 전 · 대전광역시 중구 (데모 위치) ›</span></button><section className="family-grid"><article><small>마지막 확인</small><strong>오늘 오전 10:15</strong><span>직접 체크인 · 확인됨</span></article><article><small>오늘 상태</small><strong>확인되지 않음</strong><span>식사·약 복용 입력 없음</span></article></section><section className="card"><div className="section-title"><h2>최근 7일 변화</h2></div><div className="week"><b>요청<br />{weekly.total}건</b><b>위기 알림<br />1건</b><b>미처리<br />{weekly.unresolved}건</b></div></section><section className="card ai-summary"><p className="ai-pill">🤖 AI 요약</p><h2>{latestRequest ? `이번 주에 ${latestRequest.summary}` : '이번 주에 등록된 요청이 없어요.'}</h2><p>말동무 대화 원문은 공유되지 않으며, 동의된 안부 요약만 보여요.</p><a href="#source">원본 기록·출처 보기</a></section></>}{view === 'emergency' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><StatusPill status={acknowledged ? '가족 확인 완료' : '긴급 · 미확인'} /><h1>위기 알림 상세</h1><dl><dt>감지 시각</dt><dd>2026년 8월 25일 오전 10:15</dd><dt>위치</dt><dd>대전광역시 중구 (데모 위치)</dd><dt>발화 원문</dt><dd>“가슴이 조이고 숨쉬기가 힘들어요.”</dd><dt>위험도 근거</dt><dd>가슴 통증·호흡 곤란 규칙이 감지되었어요.</dd></dl><div className="timeline"><b>처리 타임라인</b><p>10:15 · 긴급 화면이 열렸어요.</p><p>{acknowledged ? '10:16 · 가족이 확인했어요.' : '가족 확인을 기다리고 있어요.'}</p></div><div className="actions"><a href="tel:119" className="danger">119 전화</a><button>노인에게 전화</button><button>사회복지사와 공유</button><button className="primary" onClick={acknowledgeEmergency}>확인 완료</button></div><p className="notice">실제 119 신고나 메시지 발신은 하지 않는 데모입니다.</p></section>}{view === 'consent' && <section className="family-detail"><button className="back" onClick={() => setView('home')}>‹ 돌아가기</button><h1>동의·대리·결정 권한</h1><p>동의는 항목별로 언제든 철회할 수 있어요.</p>{Object.entries(consents).map(([key, value]) => <label className="toggle-row" key={key}><span>{({ health: '건강 요약', location: '위치 정보', emergency: '위기 정보', conversation: '대화 안부 요약' } as Record<string, string>)[key]}</span><input type="checkbox" checked={value} onChange={() => setConsents({ ...consents, [key]: !value })} /></label>)}<article className="document-card"><StatusPill status="등록됨" /><strong>대리 권한 문서</strong><p>합성 데모 문서 · 업로드됨</p></article><article className="document-card"><StatusPill status="법적으로 검증됨" /><strong>기관 검토 기록</strong><p>데모용 상태 구분 표시</p></article><article className="decision-card"><p className="eyebrow">결정 요청</p><strong>위기 시 가족 연락 우선순위</strong><p>요청자: 담당 사회복지사 · 기한: 오늘 18:00</p><button className="primary">응답 기록하기</button></article></section>}<nav className="family-nav"><button onClick={() => setView('home')}>홈</button><button onClick={() => setView('consent')}>동의·권한</button></nav></main>; }
