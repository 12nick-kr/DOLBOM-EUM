import { NextRequest, NextResponse } from 'next/server';
import { loginSchema, virtualPhoneToE164 } from '@/lib/auth/credentials';
import { demoSessionCookie, signDemoSession } from '@/lib/auth/sessionToken';
import { authenticateDemoAccount } from '@/lib/server/accountStore';
import { createSupabaseResponseClient, hasSupabaseAuthEnvironment } from '@/lib/server/supabaseAuth';

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '가상 전화번호와 숫자 6자리 비밀번호를 확인해 주세요.' }, { status: 400 });

  const { phone, pin } = parsed.data;
  if (hasSupabaseAuthEnvironment()) {
    const response = NextResponse.json({ redirectTo: '/' });
    const client = createSupabaseResponseClient(request, response);
    const { data, error } = await client.auth.signInWithPassword({ phone: virtualPhoneToE164(phone), password: pin });
    const role = data.user?.app_metadata.role;
    if (error || !data.user || !['senior', 'family', 'worker'].includes(role)) {
      return NextResponse.json({ error: '가상 전화번호 또는 비밀번호를 확인해 주세요.' }, { status: 401 });
    }
    return NextResponse.json({ redirectTo: `/${role}` }, { headers: response.headers });
  }

  const account = await authenticateDemoAccount(phone, pin);
  if (!account) return NextResponse.json({ error: '가상 전화번호 또는 비밀번호를 확인해 주세요.' }, { status: 401 });
  const token = await signDemoSession({ sub: account.id, role: account.role, displayName: account.displayName });
  const response = NextResponse.json({ redirectTo: `/${account.role}` });
  response.cookies.set(demoSessionCookie, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
  return response;
}
