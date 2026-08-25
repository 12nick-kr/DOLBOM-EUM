import { NextResponse } from 'next/server'; import { welfareFixtures } from '@/lib/server/facilities';
export async function GET() { return NextResponse.json({ data: welfareFixtures, fallback: true, is_demo: true }); }
