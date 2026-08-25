import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '돌봄이음 AI', description: '동의 기반 돌봄 협업 데모' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
