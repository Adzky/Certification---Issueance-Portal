import { expect, test, type Page } from '@playwright/test';

/** Role card title, the demo user listed first in the picker, and a nav label only that role has. */
const ROLES = [
  { label: 'Issuance Officer', user: 'Andi Pratama', navLabel: 'Draft Documents' },
  { label: 'Document Verifier', user: 'Dewi Lestari', navLabel: 'Verification Queue' },
  { label: 'Authorised Signatory', user: 'Budi Santoso', navLabel: 'Signing Queue' },
  { label: 'Issuance Manager', user: 'Rina Wulandari', navLabel: 'Workflow Monitoring' },
  { label: 'System Administrator', user: 'Fajar Hidayat', navLabel: 'User & Role Management' },
] as const;

type RoleLabel = (typeof ROLES)[number]['label'];

async function loginAs(page: Page, label: RoleLabel): Promise<void> {
  const role = ROLES.find((r) => r.label === label)!;
  if (!page.url().endsWith('/login')) await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${role.label}`) }).click();
  const picker = page.getByRole('dialog');
  await expect(picker).toBeVisible();
  // The main demo user is listed first.
  await expect(picker.getByRole('button').filter({ hasText: role.user }).first()).toBeVisible();
  await picker.getByRole('button', { name: new RegExp(role.user) }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });

test('login as each role shows its sidebar', async ({ page }) => {
  for (const role of ROLES) {
    await loginAs(page, role.label);
    await expect(page.getByText(`Role: ${role.label}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: `Dashboard – ${role.label}` })).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: role.navLabel })).toBeVisible();
    await page.getByRole('button', { name: 'Switch Role' }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('switching role on a forbidden page lands on dashboard', async ({ page }) => {
  await loginAs(page, 'Issuance Officer');
  await page.goto('/requests');
  await expect(page).toHaveURL(/\/requests$/);
  await page.getByRole('button', { name: 'Switch Role' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, 'Document Verifier');
  await page.goto('/requests');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('stub page shows full-release panel', async ({ page }) => {
  await loginAs(page, 'Issuance Manager');
  await sidebar(page).getByRole('link', { name: 'Reports & Analytics' }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByText('Available in full release')).toBeVisible();
});

test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible();
});

test('header user menu signs out and the notification bell opens its list', async ({ page }) => {
  await loginAs(page, 'Issuance Officer');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByRole('menu').getByText('Notifications')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Andi Pratama/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
