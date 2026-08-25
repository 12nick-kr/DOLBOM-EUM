import { NextRequest, NextResponse } from 'next/server';
import { demoSessionCookie } from '@/lib/auth/sessionToken';
import { createSupabaseResponseClient, hasSupabaseAuthEnvironment } from '@/lib/server/supabaseAuth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ redirectTo: '/login' });
  if (hasSupabaseAuthEnvironment()) {
    await createSupabaseResponseClient(request, response).auth.signOut();
  }
  response.cookies.set(demoSessionCookie, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
