import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { demoSessionCookie, verifyDemoSession } from '@/lib/auth/sessionToken';
import { roleSchema, type Role } from '@/lib/domain/types';

const protectedRoots = ['/senior', '/family', '/worker'];
const authPages = ['/login', '/signup'];

function redirectWithCookies(request: NextRequest, path: string, source: NextResponse) {
  const redirected = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of source.cookies.getAll()) redirected.cookies.set(cookie);
  return redirected;
}

async function sessionRole(request: NextRequest, response: NextResponse): Promise<Role | null> {
  if (process.env.NODE_ENV === 'test') {
    const testRole = roleSchema.safeParse(request.headers.get('x-test-role'));
    if (testRole.success) return testRole.data;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }),
      },
    });
    const { data: { user } } = await client.auth.getUser();
    const parsed = roleSchema.safeParse(user?.app_metadata.role);
    return parsed.success ? parsed.data : null;
  }

  const session = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  return session?.role ?? null;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const role = await sessionRole(request, response);
  const root = protectedRoots.find((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));

  if (root) {
    if (!role) return redirectWithCookies(request, '/login', response);
    if (root.slice(1) !== role) return redirectWithCookies(request, `/${role}`, response);
  }

  if (role && authPages.includes(request.nextUrl.pathname)) return redirectWithCookies(request, `/${role}`, response);
  return response;
}

export const config = { matcher: ['/senior/:path*', '/family/:path*', '/worker/:path*', '/login', '/signup'] };
