import { DomainError } from '@/domain/errors';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { created, toErrorResponse, withActor } from '@/server/handler';
import { parseQuery, registrationListQuerySchema } from '@/server/schemas';
import {
  listRegistrations,
  submitRegistration,
  type RegistrationFileInput,
  type SubmitRegistrationInput,
} from '@/services/registrations';

export const GET = withActor((actor, req) => listRegistrations(actor, parseQuery(req, registrationListQuerySchema)));

/**
 * Public onboarding submit. multipart/form-data: `payload` = JSON string of the
 * registration fields, `file1`..`file7` = the control-document PDFs (slot order).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new DomainError('VALIDATION', 'Expected a multipart/form-data body');
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
    for (let slot = 1; slot <= REQUIRED_CONTROL_DOCUMENTS.length; slot++) {
      const file = form.get(`file${slot}`);
      if (file instanceof File) {
        files.push({ slot, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      }
    }
    // The service validates every field and file (it owns the rules).
    const input = { ...(payload as Omit<SubmitRegistrationInput, 'files'>), files };
    return created(await submitRegistration(input));
  } catch (e) {
    return toErrorResponse(e);
  }
}
