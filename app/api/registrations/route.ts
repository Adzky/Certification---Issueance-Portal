import { DomainError } from '@/domain/errors';
import { MAX_UPLOAD_BYTES, REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { readFormDataLimited } from '@/server/body';
import { created, toErrorResponse, withActor } from '@/server/handler';
import { parseQuery, registrationListQuerySchema } from '@/server/schemas';
import {
  listRegistrations,
  slotLabel,
  submitRegistration,
  type RegistrationFileInput,
  type SubmitRegistrationInput,
} from '@/services/registrations';

export const GET = withActor((actor, req) => listRegistrations(actor, parseQuery(req, registrationListQuerySchema)));

const SLOTS = REQUIRED_CONTROL_DOCUMENTS.length;
/** Seven max-size PDFs plus 1 MB for the payload and multipart framing. */
const MAX_REGISTRATION_BODY_BYTES = SLOTS * MAX_UPLOAD_BYTES + 1024 * 1024;
const ALLOWED_PARTS = new Set(['payload', ...REQUIRED_CONTROL_DOCUMENTS.map((_, i) => `file${i + 1}`)]);

/**
 * Public onboarding submit. multipart/form-data: `payload` = JSON string of the
 * registration fields, `file1`..`file7` = the control-document PDFs (slot order).
 * The body is size-bounded before it is parsed (this endpoint is unauthenticated).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const form = await readFormDataLimited(
      req,
      MAX_REGISTRATION_BODY_BYTES,
      `Upload exceeds the ${Math.round(MAX_REGISTRATION_BODY_BYTES / (1024 * 1024))} MB request limit`,
    );
    const seen = new Set<string>();
    for (const key of form.keys()) {
      if (!ALLOWED_PARTS.has(key)) throw new DomainError('VALIDATION', `Unexpected form field ${key}`);
      if (seen.has(key)) throw new DomainError('VALIDATION', `Form field ${key} was sent more than once`);
      seen.add(key);
    }
    const raw = form.get('payload');
    if (typeof raw !== 'string') throw new DomainError('VALIDATION', 'payload: registration data is required');
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new DomainError('VALIDATION', 'payload: must be valid JSON');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new DomainError('VALIDATION', 'payload: must be a JSON object');
    }
    const files: RegistrationFileInput[] = [];
    for (let slot = 1; slot <= SLOTS; slot++) {
      const file = form.get(`file${slot}`);
      if (file === null) continue;
      if (!(file instanceof File)) throw new DomainError('VALIDATION', `${slotLabel(slot)}: a PDF file is required`);
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new DomainError('VALIDATION', `${slotLabel(slot)}: file exceeds the 10 MB limit`);
      }
      files.push({ slot, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    // The service validates every field and file (it owns the rules).
    const input = { ...(payload as Omit<SubmitRegistrationInput, 'files'>), files };
    return created(await submitRegistration(input));
  } catch (e) {
    return toErrorResponse(e);
  }
}
