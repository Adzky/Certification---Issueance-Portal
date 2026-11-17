/**
 * Pure path rules for the root `proxy.ts` (portal route guard, ruling R5). The API
 * enforces permissions itself; this keeps signed-out users out of portal pages and
 * each role inside the pages its sidebar offers.
 */
import { isPathAllowed } from '@/domain/nav';
import type { SessionData } from './session';

const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/api', '/_next', '/brand'];
/** Exactly the favicon/icon asset files (`/icon`, `/icon.svg`, `/favicon.ico`), not `/icons` or `/iconography`. */
const ASSET_FILE = /^\/(icon|favicon)(\.[a-z0-9]+)?$/;

/** `/login`, `/register/**`, `/verify/**`, `/api/**` (own auth), Next internals, `/brand/**` and the favicon/icon files. */
export function isPublicPath(pathname: string): boolean {
  if (ASSET_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Per-role page access for a signed-in user: the role's nav pages (`allowedPaths`) and their sub-pages. */
export function isPathAllowedForRole(session: SessionData, pathname: string): boolean {
  return isPathAllowed(session.role, pathname);
}
