import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers';

const loginAsOfficer = (page: Page) => loginAs(page, 'ISSUANCE_OFFICER');

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });

test('officer creates a request and prepares a draft', async ({ page }) => {
  await loginAsOfficer(page);
  await sidebar(page).getByRole('link', { name: 'Issuance Requests' }).click();
  await expect(page).toHaveURL(/\/requests/);
  await expect(page.getByRole('heading', { name: 'Issuance Requests', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Create Issuance Request' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Client' }).click();
  await page.getByRole('option', { name: 'PT Surya Kencana Industri' }).click();
  await dialog.getByRole('combobox', { name: 'Service scope' }).click();
  await page.getByRole('option', { name: 'Certification – ISO 9001' }).click();
  await dialog.getByLabel('Object / scope').fill('Head office quality system');
  await dialog.getByRole('combobox', { name: 'Priority' }).click();
  await page.getByRole('option', { name: 'High' }).click();
  await dialog.getByRole('button', { name: 'Create Request' }).click();

  // Newest request first, with the "Submitted" pill; it is selected right after creation.
  const table = page.getByRole('table', { name: 'Issuance requests' });
  const firstRow = table.locator('tbody tr').first();
  await expect(firstRow).toContainText('PT Surya Kencana Industri');
  await expect(firstRow).toContainText('Submitted');
  await firstRow.click();

  const panel = page.getByRole('region', { name: 'Request Detail' });
  await expect(panel).toContainText('Head office quality system');
  await panel.getByRole('button', { name: 'Prepare Document' }).click();

  await expect(page).toHaveURL(/\/drafts\/[^/]+\/edit$/, { timeout: 20_000 });
  await expect(page.getByLabel('Client name')).toHaveValue('PT Surya Kencana Industri');
  const draftNo = (await page.getByTestId('draft-number').innerText()).trim();
  expect(draftNo).toMatch(/^DRF-/);

  await page.getByLabel('Client address').fill('Jl. Industri No. 12, Cikarang, Bekasi');
  await page.getByLabel('Certified sites').fill('Head office, Cikarang');
  await page.getByLabel('Audit date').fill('2026-11-10');
  // The live preview mirrors the form.
  await expect(page.getByRole('group', { name: /Document preview/ })).toContainText('Head office, Cikarang');
  await page.getByRole('button', { name: 'Save & Send to Verification' }).click();
  await expect(page.getByText('Sent to verification').first()).toBeVisible();

  await sidebar(page).getByRole('link', { name: 'Draft Documents' }).click();
  await expect(page).toHaveURL(/\/drafts/);
  const row = page.getByRole('table', { name: 'Draft documents' }).locator('tbody tr', { hasText: draftNo });
  await expect(row).toContainText('Under Verification');
});

test('officer cannot pick CDKAB scope', async ({ page }) => {
  await loginAsOfficer(page);
  await page.goto('/requests');
  await page.getByRole('button', { name: 'Create Issuance Request' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Service scope' }).click();
  await expect(page.getByRole('option', { name: 'Certification – ISO 27001' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Certification – CDKAB' })).toHaveCount(0);
});

test('filters narrow the table', async ({ page }) => {
  await loginAsOfficer(page);
  await page.goto('/requests');
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Issued' }).click();
  await expect(page).toHaveURL(/status=ISSUED/);
  const rows = page.getByRole('table', { name: 'Issuance requests' }).locator('tbody tr');
  await expect(rows.first()).toContainText('Issued');
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('td').nth(4)).toHaveText('Issued');
});

test('sorting by priority puts High first; selection lives in the URL', async ({ page }) => {
  await loginAsOfficer(page);
  await page.goto('/requests');
  const table = page.getByRole('table', { name: 'Issuance requests' });
  await table.getByRole('button', { name: /Priority/ }).click();
  await expect(page).toHaveURL(/sort=priority/);
  await expect(table.locator('tbody tr').first().locator('td').nth(5)).toContainText('High');
  await table.locator('tbody tr').first().click();
  await expect(page).toHaveURL(/select=/);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Request Detail' })).toContainText('REQ-');
  await expect(page).toHaveURL(/sort=priority/);
});
