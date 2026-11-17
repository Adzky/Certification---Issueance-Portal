/**
 * Route-handler wrapper: session → actor, JSON responses, and the one place where
 * errors become the contract's `{ error: { code, message } }` shape.
 */
import { ZodError } from 'zod';
import { DomainError, type ErrorCode } from '@/domain/errors';
import type { Actor } from '@/domain/types';
import type { ApiErrorCode, ErrorBody } from '@/contract/types';
import { loadActor } from '@/services/registrations';
import { readSession } from './session';

const STATUS: Record<ErrorCode, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  UNAUTHENTICATED: 401,
};

export function errorResponse(code: ApiErrorCode, message: string, headers?: HeadersInit): Response {
  const status = code === 'INTERNAL' ? 500 : STATUS[code];
  return Response.json({ error: { code, message } } satisfies ErrorBody, { status, headers });
}

/** Write conflicts from SQLite/libsql or Prisma: the client may simply retry. */
function isWriteConflict(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: unknown }).code;
  if (code === 'P2034' || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') return true;
  const message = e instanceof Error ? e.message : '';
  return /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(message);
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof DomainError) return errorResponse(e.code, e.message);
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return errorResponse('VALIDATION', `${path}${issue?.message ?? 'Invalid input'}`);
  }
  if (isWriteConflict(e)) return errorResponse('CONFLICT', 'The record was changed by someone else; please retry');
  console.error('Unhandled API error', e);
  return errorResponse('INTERNAL', 'Unexpected error');
}

/** Context passed to handlers: dynamic route params, already awaited. */
export interface HandlerContext<P> {
  params: P;
}
type NextContext<P> = { params: Promise<P> };
type Route<P> = (req: Request, ctx: NextContext<P>) => Promise<Response>;
type Result = Response | object | null;

function toResponse(result: Result): Response {
  if (result instanceof Response) return result;
  return Response.json(result);
}

/** 201 Created with a JSON body. */
export const created = (body: object): Response => Response.json(body, { status: 201 });

/** Loads the session's actor, or null when there is no valid session / assignment. */
export async function currentActor(req: Request): Promise<Actor | null> {
  const session = await readSession(req);
  return session ? loadActor(session.userId, session.role) : null;
}

export function withActor<P = Record<string, string>>(
  handler: (actor: Actor, req: Request, ctx: HandlerContext<P>) => Promise<Result>,
): Route<P>;
export function withActor<P = Record<string, string>>(
  handler: (actor: Actor | null, req: Request, ctx: HandlerContext<P>) => Promise<Result>,
  opts: { public: true },
): Route<P>;
export function withActor<P>(
  handler: (actor: Actor, req: Request, ctx: HandlerContext<P>) => Promise<Result>,
  opts: { public?: boolean } = {},
): Route<P> {
  return async (req, ctx) => {
    try {
      const params = (await ctx?.params) ?? ({} as P);
      if (opts.public) return toResponse(await handler(null as unknown as Actor, req, { params }));
      const actor = await currentActor(req);
      if (!actor) return errorResponse('UNAUTHENTICATED', 'Sign in required');
      return toResponse(await handler(actor, req, { params }));
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
