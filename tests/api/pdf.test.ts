import { beforeEach, describe, expect, it } from 'vitest';
import * as pdfRoute from '@app/api/certificates/[id]/pdf/route';
import { resetDb, seedMinimal, sessionCookie, type Fixture } from '../setup/db';
import { issueOne } from '../setup/journey';

let f: Fixture;

async function getPdf(id: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  const req = new Request(`http://localhost:3000/api/certificates/${id}/pdf`, { headers });
  return pdfRoute.GET(req, { params: Promise.resolve({ id }) });
}

describe('certificate PDF route', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('pdf route returns a PDF', async () => {
    const { certificate } = await issueOne(f);
    const res = await getPdf(certificate.id, await sessionCookie(f.officer.userId, f.officer.role));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${certificate.number}.pdf"`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
  }, 30_000);

  it('requires a session and an existing certificate', async () => {
    const { certificate } = await issueOne(f);
    expect((await getPdf(certificate.id)).status).toBe(401);
    const missing = await getPdf('nope', await sessionCookie(f.officer.userId, f.officer.role));
    expect(missing.status).toBe(404);
  });
});
