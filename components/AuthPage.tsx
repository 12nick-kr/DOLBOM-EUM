'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { formatVirtualPhone } from '@/lib/auth/credentials';
import type { Role } from '@/lib/domain/types';

const roleCopy: Record<Role, { label: string; description: string }> = {
  senior: { label: '노인', description: '요청 카드와 긴급 도움을 사용해요.' },
  family: { label: '부양가족', description: '연결된 노인의 현황을 확인해요.' },
  worker: { label: '사회복지사', description: '담당 노인의 요청을 관리해요.' },
};

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [role, setRole] = useState<Role>('senior');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const body = mode === 'signup' ? { displayName, phone, pin, pinConfirm, role } : { phone, pin };
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error(result.error ?? '처리하지 못했어요.');
      router.replace(result.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <span className="demo-badge">가상 계정 데모</span>
      <p className="eyebrow">DOLBOM EUM AI</p>
      <h1 id="auth-title">{mode === 'signup' ? '계정 만들기' : '돌봄이음 로그인'}</h1>
      <p className="auth-description">실제 전화번호가 아닌 <strong>010-0000-0001</strong> 형태의 가상 번호를 사용해 주세요.</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && <fieldset className="role-selector">
          <legend>계정 역할</legend>
          <div>{(Object.keys(roleCopy) as Role[]).map((item) => <button type="button" key={item} aria-pressed={role === item} className={role === item ? 'selected' : ''} onClick={() => setRole(item)}><strong>{roleCopy[item].label}</strong><span>{roleCopy[item].description}</span></button>)}</div>
        </fieldset>}
        {mode === 'signup' && <label><span>이름</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={30} required placeholder="김순자" /></label>}
        <label><span>가상 전화번호</span><input inputMode="numeric" autoComplete="username" value={phone} onChange={(event) => setPhone(formatVirtualPhone(event.target.value))} maxLength={13} required placeholder="010-0000-0001" /></label>
        <label><span>로그인 비밀번호 숫자 6자리</span><input type="password" inputMode="numeric" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength={6} maxLength={6} required placeholder="••••••" /></label>
        {mode === 'signup' && <label><span>비밀번호 확인</span><input type="password" inputMode="numeric" autoComplete="new-password" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength={6} maxLength={6} required placeholder="••••••" /></label>}
        {error && <p className="notice error-notice" role="alert">{error}</p>}
        <button className="primary wide" disabled={submitting}>{submitting ? '처리 중이에요…' : mode === 'signup' ? '계정 만들기' : '로그인'}</button>
      </form>
      <p className="auth-switch">{mode === 'signup' ? '이미 계정이 있나요?' : '아직 계정이 없나요?'} <Link href={mode === 'signup' ? '/login' : '/signup'}>{mode === 'signup' ? '로그인' : '회원가입'}</Link></p>
    </section>
  </main>;
}
