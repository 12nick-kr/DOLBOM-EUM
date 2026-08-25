import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { demoSeniorId, id, state } from '@/lib/server/store';
export async function POST(request: NextRequest) {
  const parsed = z.object({ utterance: z.string().min(1), location: z.string().default('위치 정보 없음'), confirmed: z.literal(true) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '긴급 알림은 본인 확인 후에만 만들 수 있어요.' }, { status: 400 });
  const event = { id: id('emergency'), seniorId: demoSeniorId, utterance: parsed.data.utterance, location: parsed.data.location, level: 'emergency' as const, status: 'detected' as const, createdAt: new Date().toISOString(), actions: [{ actor: 'senior' as const, action: '알림 초안 확인', result: '가족·복지사 앱 내 알림 생성', at: new Date().toISOString() }] };
  state.emergencies.unshift(event); return NextResponse.json({ ...event, is_demo: true }, { status: 201 });
}
export async function GET() { return NextResponse.json({ data: state.emergencies, is_demo: true }); }
