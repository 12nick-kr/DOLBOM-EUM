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
      if (error || !data.user) {
        // Phone(전화번호) 로그인 provider가 프로젝트에서 꺼져 있으면 매 시도가 여기서 실패한다.
        // 서버 로그에 원문을 남겨 콘솔 재조회 없이 원인을 바로 알 수 있게 한다.
        console.error('[auth/signup] Supabase createUser 실패:', error?.code, error?.message);
        if (error?.code === 'phone_provider_disabled' || /phone.*(disabled|not enabled)/i.test(error?.message ?? '')) {
          throw new Error('PHONE_PROVIDER_DISABLED');
        }
        throw new Error(error?.message ?? '계정을 만들지 못했어요.');
      }

      // 이후 어느 단계가 실패하든(프로필 저장, 로그인) 방금 만든 auth 사용자를 정리한다.
      // 그렇지 않으면 이 번호로는 다시는 가입할 수 없는 고아 계정이 영구히 남는다 —
      // 사용자에게는 "만든 적 없는데 이미 가입됨"으로 보이는 원인이었다.
      try {
        const { error: profileError } = await admin.from('profiles').insert({
          id: data.user.id,
          role,
          display_name: displayName,
          phone_alias: phone,
          account_status: 'active',
        });
        if (profileError) throw new Error(profileError.message);

        const response = NextResponse.json({ redirectTo: `/${role}` }, { status: 201 });
        const client = createSupabaseResponseClient(request, response);
        const { error: loginError } = await client.auth.signInWithPassword({ phone: virtualPhoneToE164(phone), password: pin });
        if (loginError) throw new Error(loginError.message);
        return response;
      } catch (postCreateError) {
        await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
        throw postCreateError;
      }
    }

    const account = await createDemoAccount({ displayName, phone, pin, role });
    const token = await signDemoSession({ sub: account.id, role: account.role, displayName: account.displayName });
    const response = NextResponse.json({ redirectTo: `/${role}` }, { status: 201 });
    response.cookies.set(demoSessionCookie, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
    return response;
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    // Supabase Auth의 중복 전화번호 에러는 영문(예: "already been registered")으로 온다.
    // 실제 중복일 때만 409로 안내하고, 그 외 원인(설정 누락 등)은 원문을 노출하지 않되
    // "이미 가입됨"으로 뭉뚱그리지 않는다 — 안 그러면 실제 원인을 알 수 없게 된다.
    if (raw.includes('이미 사용') || /already.*registered/i.test(raw)) {
      return NextResponse.json({ error: '이미 가입된 가상 전화번호예요. 다른 번호를 사용해 주세요.' }, { status: 409 });
    }
    if (raw === 'PHONE_PROVIDER_DISABLED') {
      return NextResponse.json({ error: '지금은 계정을 만들 수 없어요. 서비스 설정을 점검 중이에요. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
    }
    return NextResponse.json({ error: '계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
