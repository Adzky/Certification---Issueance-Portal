import { withActor } from '@/server/handler';
import { getRegistrationFile } from '@/services/registrations';

export const runtime = 'nodejs';

/** A control document of an application as an inline PDF (registration.decide). */
export const GET = withActor<{ id: string; slot: string }>(async (actor, _req, { params }) => {
  const { fileName, bytes } = await getRegistrationFile(actor, params.id, params.slot);
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${fileName.replace(/[^\w.\- ]+/g, '_')}"`,
      'cache-control': 'private, no-store',
    },
  });
});
