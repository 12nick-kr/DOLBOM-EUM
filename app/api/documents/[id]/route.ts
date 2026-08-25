import { NextResponse } from 'next/server';
export async function DELETE() { return NextResponse.json({ deleted: true, is_demo: true, audit: '데모 문서 삭제 요청 기록' }); }
