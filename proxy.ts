// Next 16 root proxy (formerly `middleware.ts`): portal route guard (ruling R5).
import { NextResponse, type NextRequest } from 'next/server';
import { isPathAllowedForRole, isPublicPath } from '@/server/guard';
import { readSession } from '@/server/session';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await readSession(request);
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  // Task 11: redirect to the role's home when the path is not in its allowedPaths.
  if (!isPathAllowedForRole(session, pathname)) return NextResponse.redirect(new URL('/dashboard', request.url));

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and common static files (re-checked in isPublicPath).
  matcher: ['/((?!api/|_next/static|_next/image|favicon\\.ico).*)'],
};
