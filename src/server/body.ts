import { DomainError } from '@/domain/errors';

/**
 * Reads the request body, refusing anything over `limit` bytes. A declared
 * Content-Length over the limit is rejected before reading; the stream itself is
 * counted too, so a missing or wrong Content-Length cannot bypass the bound.
 */
export async function readBodyLimited(req: Request, limit: number, message: string): Promise<Uint8Array> {
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    throw new DomainError('VALIDATION', message);
  }
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new DomainError('VALIDATION', message);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Reads a size-bounded multipart/form-data body. */
export async function readFormDataLimited(req: Request, limit: number, message: string): Promise<FormData> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data/i.test(contentType)) {
    throw new DomainError('VALIDATION', 'Expected a multipart/form-data body');
  }
  const bytes = await readBodyLimited(req, limit, message);
  try {
    return await new Response(bytes as BodyInit, { headers: { 'content-type': contentType } }).formData();
  } catch {
    throw new DomainError('VALIDATION', 'Expected a multipart/form-data body');
  }
}
