import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../proxy';
import { isPublicPath } from '@/server/guard';
import { sessionCookie } from '../setup/db';

const req = (pathname: string, cookie?: string) =>
  new NextRequest(`http://localhost${pathname}`, { headers: cookie ? { cookie } : {} });

describe('proxy (portal auth guard)', () => {
  it.each(['/login', '/register/1', '/register/step/2', '/verify/CERT-1', '/api/requests', '/_next/static/x.js', '/favicon.ico', '/icon.svg', '/brand/logo.svg'])(
    '%s is public',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/', '/dashboard', '/requests', '/drafts/abc/edit', '/loginx', '/registered', '/verifyx', '/requests/x.json', '/logo.png', '/drafts/a.pdf'])('%s is a portal path', (p) =>
    expect(isPublicPath(p)).toBe(false),
  );

  it('redirects unauthenticated portal access to /login', async () => {
    const res = await proxy(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('redirects a tampered cookie to /login', async () => {
    const res = await proxy(req('/dashboard', 'jmu_session=garbage'));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('lets public paths and authenticated portal access through', async () => {
    expect((await proxy(req('/login'))).headers.get('location')).toBeNull();
    const cookie = await sessionCookie('u1', 'ISSUANCE_OFFICER');
    const res = await proxy(req('/dashboard', cookie));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('proxy (per-role guard)', () => {
  it('redirects a path outside the role nav to /dashboard', async () => {
    const cookie = await sessionCookie('u1', 'DOCUMENT_VERIFIER');
    const res = await proxy(req('/requests', cookie));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
  });

  it('lets a role reach its own nav pages and sub-pages', async () => {
    const cookie = await sessionCookie('u1', 'ISSUANCE_OFFICER');
    for (const p of ['/requests', '/drafts/abc/edit', '/templates']) {
      expect((await proxy(req(p, cookie))).headers.get('location')).toBeNull();
    }
  });
});
