import { NextRequest, NextResponse } from 'next/server';
import { signupSchema, virtualPhoneToE164 } from '@/lib/auth/credentials';
import { demoSessionCookie, signDemoSession } from '@/lib/auth/sessionToken';
import { createDemoAccount } from '@/lib/server/accountStore';
import { createSupabaseAdminClient, createSupabaseResponseClient, hasSupabaseAuthEnvironment } from '@/lib/server/supabaseAuth';

export async function POST(request: NextRequest) {
  const parsed = signupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '가입 정보를 확인해 주세요.' }, { status: 400 });
  }

  const { displayName, phone, pin, role } = parsed.data;
  try {
    if (hasSupabaseAuthEnvironment()) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        phone: virtualPhoneToE164(phone),
        password: pin,
        phone_confirm: true,
        app_metadata: { role, demo_account: true },
        user_metadata: { display_name: displayName, phone_alias: phone },
      });
      if (error || !data.user) throw new Error(error?.message ?? '계정을 만들지 못했어요.');

      const { error: profileError } = await admin.from('profiles').insert({
        id: data.user.id,
        role,
        display_name: displayName,
        phone_alias: phone,
        account_status: 'active',
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw new Error(profileError.message);
      }

      const response = NextResponse.json({ redirectTo: `/${role}` }, { status: 201 });
      const client = createSupabaseResponseClient(request, response);
      const { error: loginError } = await client.auth.signInWithPassword({ phone: virtualPhoneToE164(phone), password: pin });
      if (loginError) throw new Error(loginError.message);
      return response;
    }

    const account = await createDemoAccount({ displayName, phone, pin, role });
    const token = await signDemoSession({ sub: account.id, role: account.role, displayName: account.displayName });
    const response = NextResponse.json({ redirectTo: `/${role}` }, { status: 201 });
    response.cookies.set(demoSessionCookie, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
    return response;
  } catch (error) {
    // Supabase Auth의 중복 전화번호 에러는 영문(예: "already been registered")으로 오므로
    // 원문을 그대로 노출하지 않되, 실제로 가장 흔한 원인이 "이미 등록됨"이라는 걸 문구에 반영한다.
    const message = error instanceof Error && error.message.includes('이미 사용') ? error.message : '이미 가입된 가상 전화번호예요. 다른 번호를 사용해 주세요.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
