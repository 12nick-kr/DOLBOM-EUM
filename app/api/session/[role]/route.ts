import { NextRequest, NextResponse } from 'next/server';
import { roleSchema } from '@/lib/domain/types';

export async function GET(request: NextRequest, context: { params: Promise<{ role: string }> }) {
  const { role } = await context.params;
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return NextResponse.json({ error: '알 수 없는 역할이에요.' }, { status: 400 });
  const response = NextResponse.redirect(new URL(`/${parsed.data}`, request.url));
  response.cookies.set('demo-role', parsed.data, { httpOnly: true, sameSite: 'lax', path: '/' });
  return response;
}
