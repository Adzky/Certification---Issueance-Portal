import { resetDb } from './db';
import { E2E_BASE_URL } from './env';

/** Pages compiled up front so a cold `next dev` does not reload mid-test while compiling. */
const WARM_PATHS = ['/login', '/dashboard', '/reports', '/requests'];

async function warmUp(): Promise<void> {
  const options = (await (await fetch(`${E2E_BASE_URL}/api/login-options`)).json()) as {
    role: string;
    users: { userId: string }[];
  }[];
  const manager = options.find((o) => o.role === 'ISSUANCE_MANAGER')!;
  const login = await fetch(`${E2E_BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: manager.role, userId: manager.users[0].userId }),
  });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  for (const p of WARM_PATHS) await fetch(`${E2E_BASE_URL}${p}`, { headers: { cookie }, redirect: 'manual' });
}

/** Runs after the webServer is up: fresh seeded e2e database, then warm the dev compiler. */
export default async function globalSetup(): Promise<void> {
  resetDb();
  await warmUp();
}
