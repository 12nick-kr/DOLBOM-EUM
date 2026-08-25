import { NextResponse } from 'next/server'; import { hospitalFixtures } from '@/lib/server/facilities';
export async function GET() { return NextResponse.json({ data: hospitalFixtures, fallback: true, is_demo: true }); }
