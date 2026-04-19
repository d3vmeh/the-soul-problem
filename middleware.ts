import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/admin')) return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return new NextResponse('Admin password not set', { status: 500 });

  const auth = req.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'Basic' && token) {
    const [, pass] = Buffer.from(token, 'base64').toString().split(':');
    if (pass === expected) return NextResponse.next();
  }
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="admin"' },
  });
}

export const config = { matcher: ['/admin/:path*'] };
