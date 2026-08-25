'use client';

import { useState } from 'react';

export function LogoutButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  return <button className={className} disabled={loading} onClick={async () => {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }}>{loading ? '로그아웃 중…' : '로그아웃'}</button>;
}
