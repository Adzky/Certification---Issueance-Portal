import { expect, test } from '@playwright/test';
import { loginAs, newPageAs } from './helpers';
import { resetDb } from './db';

/**
 * The README "main journey", click for click, across five roles:
 * create -> prepare -> submit -> verifier returns -> officer fixes (v1.1) -> verifier approves ->
 * signatory signs -> certificate Active -> public verify page -> manager dashboard -> audit trail.
 */
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  resetDb();
});

test('full journey: request to issued, verified certificate', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const officerNav = page.getByRole('navigation', { name: 'Main navigation' });

  // Manager dashboard before: remember the Issued count.
  const manager = await newPageAs(browser, 'ISSUANCE_MANAGER');
  const issuedBefore = Number((await manager.getByTestId('stat-issued').innerText()).replace(/[^0-9]/g, ''));

  let draftNo = '';
  let docId = '';
  let requestNo = '';

  await test.step('Officer (Andi) creates a request for PT Surya Kencana Industri, ISO 9001, High', async () => {
    await loginAs(page, 'ISSUANCE_OFFICER');
    await officerNav.getByRole('link', { name: 'Issuance Requests' }).click();
    await page.getByRole('button', { name: 'Create Issuance Request' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Client' }).click();
    await page.getByRole('option', { name: 'PT Surya Kencana Industri' }).click();
    await dialog.getByRole('combobox', { name: 'Service scope' }).click();
    await page.getByRole('option', { name: 'Certification – ISO 9001' }).click();
    await dialog.getByLabel('Object / scope').fill('Quality management system of the Cikarang plant');
    await dialog.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByRole('option', { name: 'High' }).click();
    await dialog.getByRole('button', { name: 'Create Request' }).click();

    const firstRow = page.getByRole('table', { name: 'Issuance requests' }).locator('tbody tr').first();
    await expect(firstRow).toContainText('PT Surya Kencana Industri');
    await expect(firstRow).toContainText('Submitted');
    requestNo = (await firstRow.innerText()).match(/REQ-[\w-]+/)![0];
    await firstRow.click();
  });

  await test.step('Officer prepares the document and sends it to verification', async () => {
    await page.getByRole('region', { name: 'Request Detail' }).getByRole('button', { name: 'Prepare Document' }).click();
    await expect(page).toHaveURL(/\/drafts\/[^/]+\/edit$/, { timeout: 20_000 });
    docId = page.url().match(/\/drafts\/([^/]+)\/edit/)![1];
    draftNo = (await page.getByTestId('draft-number').innerText()).trim();
    expect(draftNo).toMatch(/^DRF-/);
    // Address deliberately left incomplete: the verifier will return it for this.
    await page.getByLabel('Client address').fill('Jl. Industri');
    await page.getByLabel('Certified sites').fill('Head office, Cikarang');
    await page.getByLabel('Audit date').fill('2026-11-10');
    await page.getByRole('button', { name: 'Save & Send to Verification' }).click();
    await expect(page.getByText('Sent to verification').first()).toBeVisible();
  });

  const verifier = await newPageAs(browser, 'DOCUMENT_VERIFIER');
  await test.step('Verifier (Dewi) returns it with a comment', async () => {
    await verifier.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Verification Queue' }).click();
    await expect(verifier.getByRole('heading', { name: 'Verification Queue', level: 1 })).toBeVisible();
    // The seeded queue is long: search for the draft, then open it.
    await verifier.getByRole('searchbox', { name: 'Search' }).fill(draftNo);
    await verifier.getByRole('table', { name: 'Verification queue' }).locator('tbody tr', { hasText: draftNo }).click();
    const panel = verifier.getByRole('region', { name: 'Verification Detail' });
    await expect(panel).toContainText(draftNo);
    await panel.getByRole('button', { name: 'Return for Revision' }).click();
    const dialog = verifier.getByRole('dialog');
    await dialog.getByLabel('Reason').fill('Client address incomplete: add street, district and postcode');
    await dialog.getByRole('button', { name: 'Return for Revision' }).click();
    await expect(verifier.getByText('Returned for revision').first()).toBeVisible();
    await expect(verifier.getByRole('table', { name: 'Verification queue' }).locator('tbody tr', { hasText: draftNo })).toHaveCount(0);
  });

  await test.step('Officer sees it in Revision (v1.1), fixes the address and resubmits', async () => {
    await page.goto(`/drafts?select=${docId}`);
    const row = page.getByRole('table', { name: 'Draft documents' }).locator('tbody tr', { hasText: draftNo });
    await expect(row).toContainText('Revision');
    await expect(row).toContainText('v1.1');
    await row.click();
    const panel = page.getByRole('region', { name: 'Draft Detail' });
    await panel.getByRole('tab', { name: 'Revision History' }).click();
    await expect(panel).toContainText('Client address incomplete');
    await panel.getByRole('tab', { name: 'Overview' }).click();
    await panel.getByRole('link', { name: 'Edit Draft' }).click();
    await expect(page).toHaveURL(/\/drafts\/[^/]+\/edit$/);
    await page.getByLabel('Client address').fill('Jl. Industri No. 12, Kawasan Cikarang, Bekasi 17530');
    await page.getByRole('button', { name: 'Save & Send to Verification' }).click();
    await expect(page.getByText('Sent to verification').first()).toBeVisible();
    await officerNav.getByRole('link', { name: 'Draft Documents' }).click();
    const again = page.getByRole('table', { name: 'Draft documents' }).locator('tbody tr', { hasText: draftNo });
    await expect(again).toContainText('Under Verification');
    await expect(again).toContainText('v1.1');
  });

  await test.step('Verifier ticks the checklist and approves', async () => {
    await verifier.goto(`/verification?select=${docId}`);
    const panel = verifier.getByRole('region', { name: 'Verification Detail' });
    await panel.getByRole('tab', { name: 'Checklist' }).click();
    const boxes = panel.getByRole('checkbox');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).click();
    await panel.getByRole('button', { name: 'Approve' }).click();
    await expect(verifier.getByText('Document verified').first()).toBeVisible();
  });

  let certNo = '';
  await test.step('Signatory (Budi) signs; the success dialog shows the certificate number', async () => {
    const signatory = await newPageAs(browser, 'AUTHORISED_SIGNATORY');
    await signatory.goto(`/signing?select=${docId}`);
    await signatory.getByRole('region', { name: 'Signing Detail' }).getByRole('button', { name: 'Sign Document' }).click();
    const confirm = signatory.getByRole('dialog');
    await expect(confirm).toContainText('Sign as Budi Santoso, Authorised Signatory?');
    await confirm.getByRole('button', { name: 'Sign Document' }).click();
    await expect(signatory.getByTestId('certificate-number')).toHaveText(/^JMU-QMS-\d{4}-/);
    certNo = (await signatory.getByTestId('certificate-number').innerText()).trim();
    await expect(signatory.getByRole('dialog')).toContainText('Document signed');
    await signatory.context().close();
  });

  await test.step('Officer sees the certificate Active in Issued Certificates', async () => {
    await officerNav.getByRole('link', { name: 'Issued Certificates' }).click();
    await page.getByRole('searchbox', { name: 'Search' }).fill(certNo);
    const row = page.getByRole('table', { name: 'Issued certificates' }).locator('tbody tr', { hasText: certNo });
    await expect(row).toContainText('PT Surya Kencana Industri');
    await expect(row).toContainText('Active');
  });

  await test.step('Anyone can open the public verification page (no login)', async () => {
    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto(`/verify/${certNo}`);
    await expect(pub.getByTestId('verification-status')).toContainText('Active');
    await expect(pub.getByText('PT Surya Kencana Industri')).toBeVisible();
    await visitor.close();
  });

  await test.step('Manager (Rina) sees the Issued count go up', async () => {
    await manager.reload();
    const expected = String(issuedBefore + 1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    await expect(manager.getByTestId('stat-issued')).toHaveText(expected);
  });

  await test.step('Audit trail lists every step', async () => {
    await manager.goto('/audit');
    await manager.getByRole('searchbox', { name: 'Search' }).fill(draftNo);
    const table = manager.getByRole('table', { name: 'Audit trail' });
    await expect(table.locator('tbody tr', { hasText: 'Draft prepared' })).toHaveCount(1);
    const text = await table.innerText();
    for (const label of ['Draft prepared', 'Submitted for verification', 'Returned', 'Verified', 'Signed']) {
      expect(text, `audit trail should mention "${label}"`).toContain(label);
    }
    expect(requestNo).toMatch(/^REQ-/);
  });

  await verifier.context().close();
  await manager.context().close();
});
