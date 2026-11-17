/**
 * Pure path rules for the root `proxy.ts` (portal route guard, ruling R5). The API
 * enforces permissions itself; this only keeps signed-out users out of portal pages.
 */
import type { SessionData } from './session';

const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/api', '/_next'];
const STATIC_FILE = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|woff2?|ttf|pdf)$/i;

/** `/login`, `/register/**`, `/verify/**`, `/api/**` (own auth), Next internals and static assets. */
export function isPublicPath(pathname: string): boolean {
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Per-role page access for a signed-in user. Task 11 implements this with
 * `allowedPaths` from `src/domain/nav.ts`; until then every portal path is allowed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature fixed for Task 11
export function isPathAllowedForRole(_session: SessionData, _pathname: string): boolean {
  return true;
}
