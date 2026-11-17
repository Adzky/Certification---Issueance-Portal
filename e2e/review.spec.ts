import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiAs, loginAs, newPageAs, seedSubmittedDraft, verifyDraft, type SeededDraft } from './helpers';

let officer: APIRequestContext;
let verifier: APIRequestContext;
let signatory: APIRequestContext;
let seed: SeededDraft;

test.beforeEach(async () => {
  [officer, verifier, signatory] = await Promise.all([
    apiAs('ISSUANCE_OFFICER'),
    apiAs('DOCUMENT_VERIFIER'),
    apiAs('AUTHORISED_SIGNATORY'),
  ]);
  seed = await seedSubmittedDraft(officer);
});

test.afterEach(async () => {
  await Promise.all([officer, verifier, signatory].map((c) => c.dispose()));
});

const verifyPanel = (page: Page) => page.getByRole('region', { name: 'Verification Detail' });
const signPanel = (page: Page) => page.getByRole('region', { name: 'Signing Detail' });

test('verifier returns with comment and officer sees it', async ({ page, browser }) => {
  await loginAs(page, 'DOCUMENT_VERIFIER');
  await page.goto(`/verification?select=${seed.documentId}`);
  const panel = verifyPanel(page);
  await expect(panel).toContainText(seed.documentNumber);
  await panel.getByRole('button', { name: 'Return for Revision' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Return for Revision' }).click();
  await expect(dialog.getByText(/at least 5 characters/i)).toBeVisible();
  await dialog.getByLabel('Reason').fill('Client address incomplete');
  await dialog.getByRole('button', { name: 'Return for Revision' }).click();
  await expect(page.getByText('Returned for revision').first()).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Verification queue' }).locator('tbody tr', { hasText: seed.documentNumber }),
  ).toHaveCount(0);

  const officerPage = await newPageAs(browser, 'ISSUANCE_OFFICER');
  await officerPage.goto(`/drafts?select=${seed.documentId}`);
  const row = officerPage.getByRole('table', { name: 'Draft documents' }).locator('tbody tr', { hasText: seed.documentNumber });
  await expect(row).toContainText('Revision');
  await expect(row).toContainText('v1.1');
  await officerPage.getByRole('tab', { name: 'Revision History' }).click();
  await expect(officerPage.getByRole('region', { name: 'Draft Detail' })).toContainText('Client address incomplete');
  await officerPage.context().close();
});

test('approve disabled until checklist complete', async ({ page }) => {
  await loginAs(page, 'DOCUMENT_VERIFIER');
  await page.goto(`/verification?select=${seed.documentId}`);
  const panel = verifyPanel(page);
  const approve = panel.getByRole('button', { name: 'Approve' });
  await expect(approve).toBeDisabled();
  await panel.getByRole('tab', { name: 'Checklist' }).click();
  const boxes = panel.getByRole('checkbox');
  const n = await boxes.count();
  expect(n).toBe(6);
  for (let i = 0; i < n - 1; i++) await boxes.nth(i).click();
  await expect(approve).toBeDisabled();
  await boxes.nth(n - 1).click();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByText('Document verified').first()).toBeVisible();

  const doc = await (await signatory.get(`/api/documents/${seed.documentId}`)).json();
  expect(doc.status).toBe('READY_FOR_SIGNING');
});

test('signatory signs and gets the certificate number', async ({ page }) => {
  await verifyDraft(verifier, seed.documentId);
  await loginAs(page, 'AUTHORISED_SIGNATORY');
  await page.goto(`/signing?select=${seed.documentId}`);
  const panel = signPanel(page);
  await expect(panel).toContainText('Dewi Lestari');
  await panel.getByRole('button', { name: 'Sign Document' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Sign as Budi Santoso, Authorised Signatory?');
  await confirm.getByRole('button', { name: 'Sign Document' }).click();
  await expect(page.getByTestId('certificate-number')).toHaveText(/\S+/);
  await expect(page.getByRole('dialog')).toContainText('Document signed');
  await expect(page.getByRole('link', { name: 'View Certificate' })).toHaveAttribute('href', /\/certificates\?select=.+/);
});

test('signatory rejects and request goes back to preparation', async ({ page, browser }) => {
  await verifyDraft(verifier, seed.documentId);
  await loginAs(page, 'AUTHORISED_SIGNATORY');
  await page.goto(`/signing?select=${seed.documentId}`);
  await signPanel(page).getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('Wrong standard');
  await dialog.getByRole('button', { name: 'Reject Document' }).click();
  await expect(page.getByText('Document rejected').first()).toBeVisible();

  const officerPage = await newPageAs(browser, 'ISSUANCE_OFFICER');
  await officerPage.goto(`/requests?select=${seed.requestId}`);
  const panel = officerPage.getByRole('region', { name: 'Request Detail' });
  await expect(panel).toContainText('In Preparation');
  await expect(panel.getByRole('button', { name: 'Prepare Document' })).toBeVisible();
  await panel.getByRole('tab', { name: 'Documents' }).click();
  await expect(panel).toContainText(seed.documentNumber);
  await expect(panel).toContainText('Rejected');
  await officerPage.context().close();
});

test('stale action shows conflict toast', async ({ page }) => {
  await verifyDraft(verifier, seed.documentId);
  await loginAs(page, 'AUTHORISED_SIGNATORY');
  await page.goto(`/signing?select=${seed.documentId}`);
  const panel = signPanel(page);
  await expect(panel).toContainText(seed.documentNumber);
  const res = await signatory.post(`/api/documents/${seed.documentId}/reject`, { data: { reason: 'Rejected elsewhere' } });
  expect(res.ok()).toBeTruthy();

  await panel.getByRole('button', { name: 'Sign Document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign Document' }).click();
  await expect(page.getByText(/already updated/).first()).toBeVisible();
  // The panel refreshes to the new state: no sign action any more.
  await expect(panel.getByRole('button', { name: 'Sign Document' })).toHaveCount(0);
  await expect(panel).toContainText('Rejected');
});
