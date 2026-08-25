'use client';
import { useEffect, useState } from 'react';

const formatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' });

/**
 * 화면 상단 현재 시각(서울 기준). 노인 화면은 시각을 신뢰 정보로 읽으므로 고정 문자열을 쓰지 않는다.
 * 서버 렌더 결과와 어긋나 hydration 경고가 나지 않도록 마운트 후에만 값을 채운다.
 */
export function useSeoulClock(): string {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(formatter.format(new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
