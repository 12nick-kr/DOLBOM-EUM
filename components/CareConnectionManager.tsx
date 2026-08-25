'use client';

import { useEffect, useState } from 'react';
import { formatLoginId } from '@/lib/auth/credentials';
import type { CareGroupSummary, CareProfile } from '@/lib/server/careRelationshipRepository';

const roleLabel = { senior: '노인', family: '부양가족', worker: '사회복지사' } as const;

export function CareConnectionManager() {
  const [loginId, setLoginId] = useState('');
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [groups, setGroups] = useState<CareGroupSummary[]>([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadGroups = async () => {
    const response = await fetch('/api/care-management/groups');
    const body = await response.json();
    if (response.ok) {
      setGroups(Array.isArray(body.data) ? body.data : []);
      if (!selectedSeniorId && body.data?.[0]?.senior?.id) setSelectedSeniorId(body.data[0].senior.id);
    }
  };

  useEffect(() => { void loadGroups(); }, []);

  const search = async () => {
    setLoading(true);
    setMessage('');
    const response = await fetch(`/api/care-management/accounts?loginId=${encodeURIComponent(loginId)}`);
    const body = await response.json();
    setProfile(response.ok ? body.profile : null);
    setMessage(response.ok ? body.profile ? '' : '해당 아이디의 계정이 없어요.' : body.error ?? '검색하지 못했어요.');
    setLoading(false);
  };

  const link = async () => {
    if (!profile) return;
    const payload = profile.role === 'senior'
      ? { relationshipType: 'worker', seniorId: profile.id }
      : profile.role === 'family' && selectedSeniorId
        ? { relationshipType: 'family', seniorId: selectedSeniorId, memberId: profile.id }
        : null;
    if (!payload) { setMessage('노인을 먼저 담당 목록에 연결해 주세요.'); return; }
    setLoading(true);
    const response = await fetch('/api/care-management/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json();
    setMessage(response.ok ? '돌봄 그룹에 연결했어요.' : body.error ?? '연결하지 못했어요.');
    if (response.ok) { setProfile(null); setLoginId(''); await loadGroups(); }
    setLoading(false);
  };

  const unlink = async (seniorId: string, memberId: string) => {
    setLoading(true);
    const response = await fetch('/api/care-management/relationships', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniorId, memberId }) });
    const body = await response.json();
    setMessage(response.ok ? '연결을 해제했어요.' : body.error ?? '연결을 해제하지 못했어요.');
    if (response.ok) await loadGroups();
    setLoading(false);
  };

  return <section className="connection-page">
    <header className="worker-header"><div><p className="eyebrow">돌봄 담당 관리</p><h1>계정 연결</h1></div><span className="pill blue">활성 그룹 {groups.length}개</span></header>
    <section className="card connection-search">
      <h2>전화번호형 아이디로 기존 계정 찾기</h2>
      <p>노인을 먼저 담당자로 연결한 다음 부양가족을 같은 그룹에 추가해 주세요.</p>
      <div><input aria-label="연결할 전화번호형 아이디" inputMode="numeric" placeholder="010-0000-0001" maxLength={13} value={loginId} onChange={(event) => setLoginId(formatLoginId(event.target.value))} /><button className="secondary" disabled={loading} onClick={search}>계정 찾기</button></div>
      {profile && <article className="connection-result"><span className="pill blue">{roleLabel[profile.role]}</span><strong>{profile.displayName}</strong><span>{profile.loginId ? formatLoginId(profile.loginId) : '아이디 없음'}</span>{profile.role === 'family' && <select aria-label="연결할 노인" value={selectedSeniorId} onChange={(event) => setSelectedSeniorId(event.target.value)}><option value="">담당 노인 선택</option>{groups.map((group) => <option key={group.id} value={group.senior.id}>{group.senior.displayName}</option>)}</select>}<button className="primary" disabled={loading || profile.role === 'worker'} onClick={link}>{profile.role === 'senior' ? '담당 노인으로 연결' : '돌봄 그룹에 연결'}</button></article>}
      {message && <p className="notice" role="status">{message}</p>}
    </section>
    <div className="care-group-grid">{groups.map((group) => <article className="card care-group-card" key={group.id}><div><span className="pill mint">활성 돌봄 그룹</span><h2>{group.senior.displayName} 어르신</h2><span>{group.senior.loginId ? formatLoginId(group.senior.loginId) : '아이디 없음'}</span></div><dl><dt>담당 사회복지사</dt>{group.workers.map((worker) => <dd key={worker.id}>{worker.displayName}</dd>)}<dt>부양가족</dt>{group.family.length === 0 ? <dd>아직 연결되지 않았어요.</dd> : group.family.map((member) => <dd key={member.id}><span>{member.displayName}</span><button className="text-danger" disabled={loading} onClick={() => unlink(group.senior.id, member.id)}>연결 해제</button></dd>)}</dl><button className="secondary wide" disabled={loading} onClick={() => unlink(group.senior.id, group.workers[0]?.id ?? '')}>담당 연결 해제</button></article>)}{groups.length === 0 && <section className="card empty-care-groups"><h2>담당 노인이 없어요.</h2><p>위 검색창에서 노인 계정을 찾아 연결해 주세요.</p></section>}</div>
  </section>;
}
