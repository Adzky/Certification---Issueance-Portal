/**
 * Zod schemas for the HTTP boundary: request bodies and query strings. They check
 * shape and types; services still own business validation. A ZodError thrown here is
 * mapped to 400 VALIDATION by `withActor`.
 */
import { z } from 'zod';
import { DomainError } from '@/domain/errors';
import { ROLES } from '@/domain/permissions';
import type { Role } from '@/domain/types';

const roleEnum = z.enum(ROLES as [Role, ...Role[]], { error: 'Role is invalid' });
const optionalText = z.string().optional();
const positiveInt = z.coerce.number({ error: 'Must be a number' }).int('Must be a whole number').positive('Must be positive');

export const listQuerySchema = z.object({
  q: optionalText,
  status: optionalText,
  scopeCode: optionalText,
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
  type: z.enum(['CERTIFICATE', 'INSPECTION_REPORT']).optional(),
  from: optionalText,
  to: optionalText,
  page: positiveInt.optional(),
  pageSize: positiveInt.optional(),
  sort: optionalText,
  dir: z.enum(['asc', 'desc']).optional(),
});

export const documentListQuerySchema = listQuerySchema.extend({
  queue: z.enum(['verification', 'signing', 'returned', 'verifiedByMe', 'signedByMe']).optional(),
});
export const certificateListQuerySchema = listQuerySchema.extend({ scheme: optionalText });
export const auditListQuerySchema = listQuerySchema.extend({ entityType: optionalText, entityId: optionalText, actorId: optionalText });
export const registrationListQuerySchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() });

export const loginBody = z.object({ userId: z.string().min(1, 'User is required'), role: roleEnum });

export const createRequestBody = z.object({
  clientId: z.string({ error: 'Client is required' }),
  scopeCode: z.string({ error: 'Service scope is required' }),
  objectScope: z.string({ error: 'Object / scope is required' }),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW'], { error: 'Priority must be HIGH, NORMAL or LOW' }),
});

export const updateDocumentBody = z.object({ fields: z.record(z.string(), z.string()) });
export const verifyBody = z.object({ checklist: z.record(z.string(), z.boolean()), comment: z.string().optional() });
export const returnBody = z.object({ checklist: z.record(z.string(), z.boolean()), comment: z.string({ error: 'A comment is required' }) });
export const reasonBody = z.object({ reason: z.string({ error: 'Reason is required' }) });
export const decisionBody = z.object({
  decision: z.enum(['APPROVE', 'REJECT'], { error: 'Decision must be APPROVE or REJECT' }),
  comment: z.string().optional(),
  authorisedUntil: z.string().optional(),
});
export const updateAssignmentBody = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REVOKED', 'EXPIRED']).optional(),
  scopeCodes: z.array(z.string()).optional(),
});
export const markReadBody = z.object({ ids: z.array(z.string()).optional() });

/** Parses the URL's query string with `schema` (absent params → undefined). */
export function parseQuery<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  const params = new URL(req.url).searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of params) if (v !== '') raw[k] = v;
  return schema.parse(raw);
}

/** Reads a JSON body and parses it with `schema`. Empty body = `{}`. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const text = await req.text();
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new DomainError('VALIDATION', 'Request body must be valid JSON');
    }
  }
  return schema.parse(json);
}
