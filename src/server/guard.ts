/**
 * Pure path rules for the root `proxy.ts` (portal route guard, ruling R5). The API
 * enforces permissions itself; this keeps signed-out users out of portal pages and
 * each role inside the pages its sidebar offers.
 */
import { isPathAllowed } from '@/domain/nav';
import type { SessionData } from './session';

const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/api', '/_next', '/brand'];
/** Explicit public asset prefixes (no extension-based rule, so e.g. `/requests/x.json` stays guarded). */
const ASSET_PREFIXES = ['/favicon', '/icon'];

/** `/login`, `/register/**`, `/verify/**`, `/api/**` (own auth), Next internals, `/brand/**` and the favicon/icon files. */
export function isPublicPath(pathname: string): boolean {
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p) && !pathname.slice(p.length).includes('/'))) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Per-role page access for a signed-in user: the role's nav pages (`allowedPaths`) and their sub-pages. */
export function isPathAllowedForRole(session: SessionData, pathname: string): boolean {
  return isPathAllowed(session.role, pathname);
}
