/**
 * Session cookie (`jmu_session`, iron-session sealed). Framework-neutral: works on a
 * web `Request` so route handlers, the root `proxy.ts` and tests share one code path.
 * Never imports Prisma — the proxy uses it too.
 */
import { getIronSession, sealData, webCookies, type SessionOptions } from 'iron-session';
import { ROLES } from '@/domain/permissions';
import type { Role } from '@/domain/types';

export const SESSION_COOKIE = 'jmu_session';

export interface SessionData {
  userId: string;
  role: Role;
}

// Demo only: a fixed fallback secret so a fresh clone runs with no env vars. Set
// SESSION_SECRET (32+ chars) for anything that is not a local demo.
const DEMO_SESSION_SECRET = 'jmu-demo-session-secret-do-not-use-in-production-0001';

const TTL_SECONDS = 60 * 60 * 12;

function options(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: process.env.SESSION_SECRET ?? DEMO_SESSION_SECRET,
    ttl: TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  };
}

function isSessionData(v: Partial<SessionData>): v is SessionData {
  return typeof v.userId === 'string' && v.userId.length > 0 && (ROLES as readonly string[]).includes(v.role ?? '');
}

/** The session carried by `req`, or null (no cookie, tampered, expired or malformed). */
export async function readSession(req: Request): Promise<SessionData | null> {
  try {
    const session = await getIronSession<Partial<SessionData>>(webCookies(req, new Headers()), options());
    return isSessionData(session) ? { userId: session.userId, role: session.role } : null;
  } catch {
    return null;
  }
}

/** Writes a fresh session cookie for `data` into `headers` (as Set-Cookie). */
export async function writeSession(req: Request, headers: Headers, data: SessionData): Promise<void> {
  const session = await getIronSession<Partial<SessionData>>(webCookies(req, headers), options());
  session.userId = data.userId;
  session.role = data.role;
  await session.save();
}

/** Adds a Set-Cookie to `headers` that clears the session. */
export async function clearSession(req: Request, headers: Headers): Promise<void> {
  const session = await getIronSession<Partial<SessionData>>(webCookies(req, headers), options());
  session.destroy();
}

/** The sealed cookie value for `data` (tests and tools). */
export function sealSession(data: SessionData): Promise<string> {
  const { password, ttl } = options();
  return sealData(data, { password, ttl });
}
