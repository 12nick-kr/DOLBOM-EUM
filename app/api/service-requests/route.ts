import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { demoSeniorId, id, state } from '@/lib/server/store';
const schema = z.object({ type: z.enum(['hospital_companion', 'welfare_info']), details: z.string().min(1), destination: z.string().optional(), dueAt: z.string().optional(), confirmed: z.literal(true) });
export async function POST(request: NextRequest) { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: '요청 내용은 본인 확인 후 보낼 수 있어요.' }, { status: 400 }); const item = { id: id('request'), seniorId: demoSeniorId, ...parsed.data, status: 'new' as const, assignee: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; state.requests.unshift(item); return NextResponse.json({ ...item, is_demo: true }, { status: 201 }); }
export async function GET() { return NextResponse.json({ data: state.requests, is_demo: true }); }
