import { expect, test } from '@playwright/test';
import { issueCertificateViaApi, loginAs } from './helpers';

test('issued certificate is visible, downloadable and verifiable', async ({ page, browser }) => {
  const cert = await issueCertificateViaApi();
  await loginAs(page, 'ISSUANCE_OFFICER');
  await page.goto(`/certificates?select=${cert.certificateId}`);
  const panel = page.getByRole('region', { name: 'Certificate Detail' });
  await expect(panel).toContainText(cert.number);
  await expect(panel.getByTestId('document-preview')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Issued certificates' })).toContainText(cert.number);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('link', { name: 'Download Certificate' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`${cert.number}.pdf`);

  // A visitor without a session opens the QR target.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(`/verify/${cert.number}`);
  await expect(pub.getByTestId('verification-status')).toContainText('Active');
  await expect(pub.getByText(cert.clientName)).toBeVisible();
  await visitor.close();
});

test('manager suspends and public page shows Suspended', async ({ page, browser }) => {
  const cert = await issueCertificateViaApi();
  await loginAs(page, 'ISSUANCE_MANAGER');
  await page.goto(`/certificates?select=${cert.certificateId}`);
  const panel = page.getByRole('region', { name: 'Certificate Detail' });
  await expect(panel).toContainText(cert.number);
  await panel.getByRole('tab', { name: 'Lifecycle' }).click();
  await panel.getByRole('button', { name: 'Suspend' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('Client audit overdue');
  await dialog.getByRole('button', { name: 'Suspend Certificate' }).click();
  await expect(page.getByText('Certificate suspended').first()).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Lifecycle events' })).toContainText('Client audit overdue');
  await expect(panel.getByRole('button', { name: 'Reinstate' })).toBeVisible();

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(`/verify/${cert.number}`);
  await expect(pub.getByTestId('verification-status')).toContainText('Suspended');
  await visitor.close();
});

test('officer has no lifecycle actions', async ({ page }) => {
  const cert = await issueCertificateViaApi();
  await loginAs(page, 'ISSUANCE_OFFICER');
  await page.goto(`/certificates?select=${cert.certificateId}`);
  const panel = page.getByRole('region', { name: 'Certificate Detail' });
  await panel.getByRole('tab', { name: 'Lifecycle' }).click();
  await expect(panel.getByRole('list', { name: 'Lifecycle events' }).or(panel.getByText(/No lifecycle events/))).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Suspend' })).toHaveCount(0);
});

test('unknown certificate shows not found', async ({ browser }) => {
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto('/verify/JMU-NOPE-0000-0000');
  await expect(pub.getByText('No certificate found with this number')).toBeVisible();
  await visitor.close();
});
