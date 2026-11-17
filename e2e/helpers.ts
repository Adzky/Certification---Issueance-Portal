import { expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './env';

export type RoleName = 'ISSUANCE_OFFICER' | 'DOCUMENT_VERIFIER' | 'AUTHORISED_SIGNATORY' | 'ISSUANCE_MANAGER';

/** Demo person per role (the highlighted users of the seed data). */
export const PERSON: Record<RoleName, { card: RegExp; name: string }> = {
  ISSUANCE_OFFICER: { card: /^Issuance Officer/, name: 'Andi Pratama' },
  DOCUMENT_VERIFIER: { card: /^Document Verifier/, name: 'Dewi Lestari' },
  AUTHORISED_SIGNATORY: { card: /^Authorised Signatory/, name: 'Budi Santoso' },
  ISSUANCE_MANAGER: { card: /^Issuance Manager/, name: 'Rina Wulandari' },
};

/** Signs in through the login page (role card, then the person) and waits for the dashboard. */
export async function loginAs(page: Page, role: RoleName): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: PERSON[role].card }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(PERSON[role].name) }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A second, independently signed-in browser page (own cookie jar), e.g. to look at the other side of a hand-off. */
export async function newPageAs(browser: import('@playwright/test').Browser, role: RoleName): Promise<Page> {
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  const page = await context.newPage();
  await loginAs(page, role);
  return page;
}

/** A standalone API session (its own cookie jar) for `role`, for seeding data or acting behind the UI's back. */
export async function apiAs(role: RoleName): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: E2E_BASE_URL });
  const options = (await (await ctx.get('/api/login-options')).json()) as {
    role: string;
    users: { userId: string; name: string }[];
  }[];
  const user = options.find((o) => o.role === role)!.users.find((u) => u.name === PERSON[role].name)!;
  const res = await ctx.post('/api/session', { data: { role, userId: user.userId } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(res.ok(), `${res.url()} -> ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

export interface SeededDraft {
  requestId: string;
  requestNumber: string;
  documentId: string;
  documentNumber: string;
  clientName: string;
}

/** As the officer: new ISO 9001 request -> draft -> filled in -> submitted (document is "Under Verification"). */
export async function seedSubmittedDraft(officer: APIRequestContext, objectScope = 'E2E review scenario'): Promise<SeededDraft> {
  const ref = await json<{ clients: { id: string; name: string }[] }>(await officer.get('/api/reference'));
  const client = ref.clients.find((c) => c.name === 'PT Surya Kencana Industri')!;
  const req = await json<{ id: string; number: string }>(
    await officer.post('/api/requests', { data: { clientId: client.id, scopeCode: 'QMS', objectScope, priority: 'HIGH' } }),
  );
  const doc = await json<{ id: string; number: string }>(await officer.post(`/api/requests/${req.id}/documents`));
  await json(
    await officer.patch(`/api/documents/${doc.id}`, {
      data: {
        fields: {
          clientAddress: 'Jl. Industri No. 12, Cikarang',
          standard: 'ISO 9001:2015',
          scopeStatement: objectScope,
          sites: 'Head office, Cikarang',
          auditDate: '2026-11-10',
        },
      },
    }),
  );
  await json(await officer.post(`/api/documents/${doc.id}/submit`));
  return { requestId: req.id, requestNumber: req.number, documentId: doc.id, documentNumber: doc.number, clientName: client.name };
}

const CHECKLIST_KEYS = ['client_data', 'scope_matches', 'results_consistent', 'references_valid', 'numbering_metadata', 'impartiality'];

/** As the verifier: approves a document so it becomes "Ready for Signing". */
export async function verifyDraft(verifier: APIRequestContext, documentId: string): Promise<void> {
  const checklist = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]));
  await json(await verifier.post(`/api/documents/${documentId}/verify`, { data: { checklist } }));
}

/** Drives a fresh document through submit -> verify -> sign via the API and returns the issued certificate. */
export async function issueCertificateViaApi(objectScope = 'E2E certificate scenario'): Promise<{ certificateId: string; number: string; clientName: string }> {
  const [officer, verifier, signatory] = await Promise.all([apiAs('ISSUANCE_OFFICER'), apiAs('DOCUMENT_VERIFIER'), apiAs('AUTHORISED_SIGNATORY')]);
  try {
    const seed = await seedSubmittedDraft(officer, objectScope);
    await verifyDraft(verifier, seed.documentId);
    const signed = await json<{ certificate: { id: string; number: string } }>(await signatory.post(`/api/documents/${seed.documentId}/sign`));
    return { certificateId: signed.certificate.id, number: signed.certificate.number, clientName: seed.clientName };
  } finally {
    await Promise.all([officer.dispose(), verifier.dispose(), signatory.dispose()]);
  }
}
