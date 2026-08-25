import { NextResponse } from 'next/server';
import { fakeAi } from '@/lib/server/ai';
export async function POST() { return NextResponse.json({ ...fakeAi.transcribe(), notice: '데모 전사입니다. 실제 음성 원본은 보관하지 않아요.' }); }
