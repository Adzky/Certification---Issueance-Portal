/**
 * Pure path rules for the root `proxy.ts` (portal route guard, ruling R5). The API
 * enforces permissions itself; this keeps signed-out users out of portal pages and
 * each role inside the pages its sidebar offers.
 */
import { isPathAllowed } from '@/domain/nav';
import type { SessionData } from './session';

const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/api', '/_next'];
const STATIC_FILE = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|woff2?|ttf|pdf)$/i;

/** `/login`, `/register/**`, `/verify/**`, `/api/**` (own auth), Next internals and static assets. */
export function isPublicPath(pathname: string): boolean {
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Per-role page access for a signed-in user: the role's nav pages (`allowedPaths`) and their sub-pages. */
export function isPathAllowedForRole(session: SessionData, pathname: string): boolean {
  return isPathAllowed(session.role, pathname);
}
