import { expect, test } from '@playwright/test';
import { apiAs, issueCertificateViaApi, loginAs, seedSubmittedDraft, verifyDraft, type RoleName } from './helpers';

const STAT_LABELS: Record<RoleName, string[]> = {
  ISSUANCE_OFFICER: ['My Tasks', 'Draft', 'In Revision', 'Ready for Verification'],
  DOCUMENT_VERIFIER: ['Awaiting Verification', 'Verified', 'Returned'],
  AUTHORISED_SIGNATORY: ['Ready to Sign', 'Signed', 'Rejected'],
  ISSUANCE_MANAGER: ['Total Requests', 'In Progress', 'Issued', 'Needs Action', 'Due ≤7 days'],
  SYSTEM_ADMIN: ['Total Users', 'Active Roles', 'Document Templates', 'Uptime'],
};

const TITLE: Record<RoleName, string> = {
  ISSUANCE_OFFICER: 'Dashboard – Issuance Officer',
  DOCUMENT_VERIFIER: 'Dashboard – Document Verifier',
  AUTHORISED_SIGNATORY: 'Dashboard – Authorised Signatory',
  ISSUANCE_MANAGER: 'Dashboard – Issuance Manager',
  SYSTEM_ADMIN: 'Dashboard – System Administrator',
};

for (const role of Object.keys(STAT_LABELS) as RoleName[]) {
  test(`${role} dashboard shows its stat labels`, async ({ page }) => {
    await loginAs(page, role);
    await expect(page.getByRole('heading', { level: 1, name: TITLE[role] })).toBeVisible();
    for (const label of STAT_LABELS[role]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  });
}

test('manager dashboard has chart, donut, queue and SLA panels', async ({ page }) => {
  await loginAs(page, 'ISSUANCE_MANAGER');
  await expect(page.getByRole('heading', { name: 'Certificate Issuance Trend' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Request Status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority Issuance Queue' })).toBeVisible();
  await expect(page.getByText('SLA achieved')).toBeVisible();
  await expect(page.getByText('Target ≥ 90%')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Last 30 days' })).toBeChecked();
  const total = page.getByTestId('stat-total');
  await page.getByRole('radio', { name: 'Last 90 days' }).click();
  await expect(page.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
  await expect(total).toBeVisible();
});

test('signatory Sign button opens the signing queue on that document', async ({ page }) => {
  const [officer, verifier] = await Promise.all([apiAs('ISSUANCE_OFFICER'), apiAs('DOCUMENT_VERIFIER')]);
  try {
    const seed = await seedSubmittedDraft(officer, 'Dashboard sign scenario');
    await verifyDraft(verifier, seed.documentId);
    await loginAs(page, 'AUTHORISED_SIGNATORY');
    const sign = page.getByRole('table', { name: 'Documents ready to sign' }).getByRole('link', { name: 'Sign', exact: true }).first();
    await expect(sign).toHaveAttribute('href', /^\/signing\?select=/);
    await sign.click();
    await expect(page).toHaveURL(/\/signing\?select=/);
  } finally {
    await Promise.all([officer.dispose(), verifier.dispose()]);
  }
});

test('manager dashboard reflects a new issuance', async ({ page }) => {
  await loginAs(page, 'ISSUANCE_MANAGER');
  const issued = page.getByTestId('stat-issued');
  await expect(issued).toBeVisible();
  const before = Number((await issued.innerText()).replace(/[^0-9]/g, ''));
  await issueCertificateViaApi('Dashboard issuance scenario');
  await page.reload();
  await expect(page.getByTestId('stat-issued')).toHaveText(String(before + 1).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
});

test('audit trail shows the journey in order', async ({ page }) => {
  const [officer, verifier, signatory] = await Promise.all([apiAs('ISSUANCE_OFFICER'), apiAs('DOCUMENT_VERIFIER'), apiAs('AUTHORISED_SIGNATORY')]);
  try {
    const seed = await seedSubmittedDraft(officer, 'Audit journey scenario');
    await verifyDraft(verifier, seed.documentId);
    const res = await signatory.post(`/api/documents/${seed.documentId}/sign`);
    expect(res.ok()).toBeTruthy();
    await loginAs(page, 'ISSUANCE_MANAGER');
    await page.goto('/audit');
    await page.getByRole('searchbox', { name: 'Search' }).fill(seed.documentNumber);
    const table = page.getByRole('table', { name: 'Audit trail' });
    await expect(table.locator('tbody tr', { hasText: 'Draft prepared' })).toHaveCount(1);
    const rows = await table.locator('tbody tr').allInnerTexts();
    const order = ['Signed', 'Verified', 'Submitted for verification', 'Draft prepared'].map((label) => rows.findIndex((r) => r.includes(label)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The manager has no draft page, so document rows are plain text; the issued certificate links to the registry.
    await expect(table.locator('a[href^="/certificates?select="]').first()).toBeVisible();
    await expect(table).toContainText('Andi Pratama');
  } finally {
    await Promise.all([officer, verifier, signatory].map((c) => c.dispose()));
  }
});

test('admin sees recent system activity and the audit trail', async ({ page }) => {
  await loginAs(page, 'SYSTEM_ADMIN');
  await expect(page.getByRole('heading', { name: 'Recent System Activity' })).toBeVisible();
  await page.goto('/audit');
  await expect(page.getByRole('table', { name: 'Audit trail' })).toBeVisible();
});
