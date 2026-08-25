import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: '데모에서는 합성 문서의 인증 다운로드를 제공하지 않아요.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } }); }
