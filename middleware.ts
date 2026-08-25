import { NextRequest, NextResponse } from 'next/server';

const roles = ['/senior', '/family', '/worker'];
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!roles.includes(path)) return NextResponse.next();
  const expected = path.slice(1); const supplied = request.cookies.get('demo-role')?.value;
  if (supplied && supplied !== expected) return NextResponse.redirect(new URL(`/${supplied}`, request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/senior', '/family', '/worker'] };
