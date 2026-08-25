'use client';

import Image from 'next/image';

/** 세 화면(노인/가족/복지사) 헤더가 공유하는 로고. 텍스트 브랜드명을 대체한다. */
export function BrandLogo({ className, onClick }: { className?: string; onClick?: () => void }) {
  const image = (
    <Image
      src="/logo.png"
      alt="돌봄이음 AI"
      width={600}
      height={240}
      className={`brand-logo${className ? ` ${className}` : ''}`}
      priority
    />
  );
  if (!onClick) return image;
  return <button type="button" className="brand-logo-button" onClick={onClick} aria-label="홈으로 이동">{image}</button>;
}
