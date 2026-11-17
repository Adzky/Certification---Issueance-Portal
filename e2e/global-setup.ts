import { resetDb } from './db';
import { E2E_BASE_URL } from './env';

/** Pages compiled up front so a cold `next dev` does not reload mid-test while compiling. */
const WARM_PATHS: Record<string, string[]> = {
  ISSUANCE_MANAGER: ['/login', '/dashboard', '/reports', '/requests', '/certificates', '/verify/warm'],
  ISSUANCE_OFFICER: ['/requests', '/drafts', '/drafts/warm/edit', '/drafts/warm/print', '/certificates', '/api/certificates/warm/pdf'],
  DOCUMENT_VERIFIER: ['/verification'],
  AUTHORISED_SIGNATORY: ['/signing'],
};

async function warmUp(): Promise<void> {
  const options = (await (await fetch(`${E2E_BASE_URL}/api/login-options`)).json()) as {
    role: string;
    users: { userId: string }[];
  }[];
  for (const [role, paths] of Object.entries(WARM_PATHS)) {
    const option = options.find((o) => o.role === role)!;
    const login = await fetch(`${E2E_BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: option.role, userId: option.users[0].userId }),
    });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    for (const p of paths) await fetch(`${E2E_BASE_URL}${p}`, { headers: { cookie }, redirect: 'manual' });
  }
}

/** Runs after the webServer is up: fresh seeded e2e database, then warm the dev compiler. */
export default async function globalSetup(): Promise<void> {
  resetDb();
  await warmUp();
}
