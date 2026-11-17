import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { newPageAs } from './helpers';

const PDF = path.join(__dirname, 'fixtures', 'sample.pdf');
const PNG = path.join(__dirname, 'fixtures', 'image.png');

/** Fills the registration form (step 3) for a Document Verifier; files are uploaded by the caller. */
async function fillRegistration(page: Page, name: string, email: string) {
  await page.getByLabel('Full Name', { exact: true }).fill(name);
  await page.getByLabel('Employee ID', { exact: true }).fill('JMU-E2E-01');
  await page.getByLabel('National ID / Passport No.', { exact: true }).fill('3175000000000099');
  await page.getByLabel('Position / Job Title', { exact: true }).fill('Quality Verifier');
  await page.getByLabel('Organization Unit', { exact: true }).fill('Certification & Issuance');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Phone Number', { exact: true }).fill('+62 812-1111-2222');
  await page.getByLabel('Field of Study', { exact: true }).fill('Industrial Engineering');
  await page.getByLabel('Relevant Experience (years)', { exact: true }).fill('4');
  await page.getByLabel('Employment Start Date', { exact: true }).fill('2022-02-01');
  await page.getByRole('checkbox', { name: /ISO 9001/ }).click();
}

test('new user registers, manager approves, user logs in', async ({ page, browser }) => {
  const stamp = Date.now();
  const name = `E2E Registrant ${stamp}`;

  await page.goto('/register/1');
  await expect(page.getByRole('heading', { name: 'Select Role' })).toBeVisible();
  await page.getByRole('button', { name: /^Document Verifier/ }).click();
  await page.getByRole('button', { name: 'Continue to Role Review' }).click();

  await expect(page).toHaveURL(/\/register\/2\?role=DOCUMENT_VERIFIER/);
  await expect(page.getByRole('heading', { name: 'Role Review & Requirements' })).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to Registration & Authorisation' }).click();

  await expect(page).toHaveURL(/\/register\/3\?role=DOCUMENT_VERIFIER/);
  await fillRegistration(page, name, `e2e.${stamp}@jmu.example`);
  const inputs = page.locator('input[type=file]');
  await expect(inputs).toHaveCount(7);
  for (let i = 0; i < 7; i++) await inputs.nth(i).setInputFiles(PDF);
  await expect(page.getByText('7 / 7 Uploaded')).toBeVisible();
  await page.getByRole('checkbox', { name: /I declare/ }).click();
  await page.getByRole('button', { name: 'Submit for Authorisation' }).click();

  await expect(page).toHaveURL(/\/register\/4\?app=/);
  await expect(page.getByText('Awaiting Authorisation')).toBeVisible();
  const stepFourUrl = page.url();

  // The manager approves in a separate browser context.
  const manager = await newPageAs(browser, 'ISSUANCE_MANAGER');
  await manager.getByRole('link', { name: 'Pending Authorisations' }).click();
  await expect(manager.getByRole('heading', { name: 'Pending Authorisations' })).toBeVisible();
  await manager.getByRole('row', { name: new RegExp(name) }).click();
  const detail = manager.getByRole('region', { name: 'Authorisation Request' });
  await expect(detail.getByText('7 / 7 documents')).toBeVisible();
  await detail.getByRole('tab', { name: 'Documents' }).click();
  await expect(detail.getByRole('link', { name: /View 1\./ })).toHaveAttribute('href', /\/api\/registrations\/.+\/files\/1$/);
  await detail.getByRole('button', { name: 'Approve' }).click();
  const dialog = manager.getByRole('dialog');
  await expect(dialog.getByLabel('Authorised until')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await dialog.getByRole('button', { name: 'Approve Authorisation' }).click();
  await expect(manager.getByText('Registration approved')).toBeVisible();
  await manager.context().close();

  // The applicant's page notices within the 5 s poll interval.
  await page.goto(stepFourUrl);
  await expect(page.getByText('Authorisation Successful')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Access My Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard – Document Verifier' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${name}, Document Verifier`) })).toBeVisible();
});

test('step 4 notices an approval while open, and a rejection shows the comment', async ({ page, browser }) => {
  const stamp = Date.now();
  const manager = await newPageAs(browser, 'ISSUANCE_MANAGER');
  const api = manager.request;
  const submit = async (n: string) => {
    const buffer = fs.readFileSync(PDF);
    const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
      payload: JSON.stringify({
        role: 'DOCUMENT_VERIFIER',
        scopes: ['QMS'],
        personal: {
          fullName: n,
          employeeId: 'E1',
          nationalId: '1',
          position: 'P',
          unit: 'U',
          email: `${n.replace(/\W+/g, '.')}@jmu.example`.toLowerCase(),
          phone: '1',
        },
        employment: { education: 'Bachelor (S1)', fieldOfStudy: 'F', experienceYears: 2, employmentStatus: 'PERMANENT', startDate: '2022-01-01' },
        declarationAccepted: true,
      }),
    };
    for (let i = 1; i <= 7; i++) multipart[`file${i}`] = { name: `d${i}.pdf`, mimeType: 'application/pdf', buffer };
    const res = await api.post('/api/registrations', { multipart });
    expect(res.status()).toBe(201);
    return ((await res.json()) as { applicationId: string }).applicationId;
  };
  const approveId = await submit(`Poll Approve ${stamp}`);
  const rejectId = await submit(`Poll Reject ${stamp}`);

  await page.goto(`/register/4?app=${approveId}`);
  await expect(page.getByText('Awaiting Authorisation')).toBeVisible();
  expect((await api.post(`/api/registrations/${approveId}/decision`, { data: { decision: 'APPROVE' } })).ok()).toBeTruthy();
  await expect(page.getByText('Authorisation Successful')).toBeVisible({ timeout: 12_000 });

  await page.goto(`/register/4?app=${rejectId}`);
  expect(
    (await api.post(`/api/registrations/${rejectId}/decision`, { data: { decision: 'REJECT', comment: 'Missing training evidence' } })).ok(),
  ).toBeTruthy();
  await expect(page.getByText('Authorisation Not Granted')).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText('Missing training evidence')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a new registration' })).toBeVisible();
  await manager.context().close();
});

test('non-pdf upload shows an error on that row', async ({ page }) => {
  await page.goto('/register/3?role=DOCUMENT_VERIFIER');
  await page.locator('input[type=file]').nth(0).setInputFiles(PNG);
  const row = page.getByRole('listitem').filter({ hasText: 'Job Description & Responsibility Matrix' });
  await expect(row.getByRole('alert')).toContainText('Only PDF files are accepted');
  await expect(page.getByText('0 / 7 Uploaded')).toBeVisible();
  // Submitting the incomplete form lists what is missing instead of posting.
  await page.getByRole('button', { name: 'Submit for Authorisation' }).click();
  await expect(page).toHaveURL(/\/register\/3/);
  await expect(page.getByText('Full name is required')).toBeVisible();
});

test('save as draft keeps text fields across a reload (files are not stored)', async ({ page }) => {
  await page.goto('/register/3?role=DOCUMENT_VERIFIER');
  await page.getByLabel('Full Name', { exact: true }).fill('Draft Person');
  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue('Draft Person');
});

test('admin suspends a user and they disappear from login options', async ({ page, browser }) => {
  const options = (await (await page.request.get('/api/login-options')).json()) as {
    role: string;
    users: { userId: string; name: string }[];
  }[];
  const target = options.find((o) => o.role === 'DOCUMENT_VERIFIER')!.users.find((u) => u.name !== 'Dewi Lestari')!;

  const admin = await newPageAs(browser, 'SYSTEM_ADMIN');
  await admin.getByRole('link', { name: 'User & Role Management' }).click();
  await expect(admin.getByRole('heading', { name: 'User & Role Management' })).toBeVisible();
  await admin.getByRole('searchbox', { name: 'Search' }).fill(target.name);
  const row = admin.getByRole('row', { name: new RegExp(`${target.name}.*Document Verifier`) });
  await row.getByRole('button', { name: new RegExp(`Edit .*${target.name}`) }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Status').selectOption('SUSPENDED');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(admin.getByText('Authorisation updated')).toBeVisible();
  await expect(row.getByText('Suspended')).toBeVisible();

  const after = (await (await page.request.get('/api/login-options')).json()) as typeof options;
  const verifiers = after.find((o) => o.role === 'DOCUMENT_VERIFIER')!.users.map((u) => u.userId);
  expect(verifiers).not.toContain(target.userId);
  await admin.context().close();
});

test('settings hub: permissions card links through, other cards open a panel', async ({ browser }) => {
  const admin = await newPageAs(browser, 'SYSTEM_ADMIN');
  await admin.goto('/settings');
  await expect(admin.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await admin.getByRole('button', { name: /^General Settings/ }).click();
  await expect(admin.getByRole('dialog').getByText('Available in full release')).toBeVisible();
  await admin.keyboard.press('Escape');
  await admin.getByRole('link', { name: /^Role & Permissions/ }).click();
  await expect(admin).toHaveURL(/\/settings\/permissions$/);
  await expect(admin.getByRole('table', { name: 'Permission matrix' })).toBeVisible();
  await admin.context().close();
});
