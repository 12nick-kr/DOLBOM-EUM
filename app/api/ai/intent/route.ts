import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyUrgency } from '@/lib/domain/urgency';
export async function POST(request: NextRequest) { const data = z.object({ text: z.string().min(1) }).safeParse(await request.json()); return data.success ? NextResponse.json(classifyUrgency(data.data.text)) : NextResponse.json({ error: 'text가 필요해요.' }, { status: 400 }); }
