import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { prisma } from '@/repositories/prisma';
import { DomainError } from '@/domain/errors';
import { ROLE_ACTIONS } from '@/domain/permissions';
import { REQUIRED_CONTROL_DOCUMENTS } from '@/domain/registration';
import { withActor } from '@/server/handler';
import { createRequest } from '@/services/requests';
import { prepareDocument } from '@/services/documents';
import * as requestsRoute from '@app/api/requests/route';
import * as signRoute from '@app/api/documents/[id]/sign/route';
import * as publicCertRoute from '@app/api/public/certificates/[number]/route';
import * as sessionRoute from '@app/api/session/route';
import * as loginOptionsRoute from '@app/api/login-options/route';
import * as registrationsRoute from '@app/api/registrations/route';
import * as notificationsRoute from '@app/api/notifications/route';
import * as notificationsReadRoute from '@app/api/notifications/read/route';
import * as documentsRoute from '@app/api/documents/route';
import { resetDb, seedMinimal, sessionCookie, type Fixture } from '../setup/db';
import { issueOne } from '../setup/journey';

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

async function call(
  handler: Handler,
  opts: { method?: string; path?: string; cookie?: string; body?: unknown; form?: FormData; params?: Record<string, string> } = {},
) {
  const headers = new Headers();
  if (opts.cookie) headers.set('cookie', opts.cookie);
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  const req = new Request(`http://localhost${opts.path ?? '/api/x'}`, { method: opts.method ?? 'GET', headers, body });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) as Promise<never> });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- assertions inspect arbitrary JSON
  return { status: res.status, headers: res.headers, json: text ? (JSON.parse(text) as any) : null };
}

let f: Fixture;

describe('REST API', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('unauthenticated request is 401', async () => {
    const r = await call(requestsRoute.GET, { path: '/api/requests' });
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe('UNAUTHENTICATED');
  });

  it('a session for a user/role that no longer exists is 401', async () => {
    const r = await call(requestsRoute.GET, { path: '/api/requests', cookie: await sessionCookie('nobody', 'ISSUANCE_OFFICER') });
    expect(r.status).toBe(401);
  });

  it('a tampered cookie is 401', async () => {
    const r = await call(requestsRoute.GET, { path: '/api/requests', cookie: 'jmu_session=Fe26.2*garbage' });
    expect(r.status).toBe(401);
  });

  it('role without access gets 403', async () => {
    const r = await call(requestsRoute.POST, {
      method: 'POST',
      path: '/api/requests',
      cookie: await sessionCookie(f.verifier.userId, f.verifier.role),
      body: { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'Steel pipes', priority: 'NORMAL' },
    });
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(typeof r.json.error.message).toBe('string');
  });

  it('invalid body is 400 VALIDATION', async () => {
    const r = await call(requestsRoute.POST, {
      method: 'POST',
      path: '/api/requests',
      cookie: await sessionCookie(f.officer.userId, f.officer.role),
      body: { scopeCode: 'QMS', objectScope: 'Steel pipes', priority: 'NORMAL' },
    });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('VALIDATION');
  });

  it('malformed JSON body is 400 VALIDATION', async () => {
    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { cookie: await sessionCookie(f.officer.userId, f.officer.role), 'content-type': 'application/json' },
      body: '{not json',
    });
    const res = await requestsRoute.POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('creates a request (201) and lists it with query params', async () => {
    const cookie = await sessionCookie(f.officer.userId, f.officer.role);
    const created = await call(requestsRoute.POST, {
      method: 'POST',
      path: '/api/requests',
      cookie,
      body: { clientId: f.clientId, scopeCode: 'QMS', objectScope: 'Steel pipes', priority: 'HIGH' },
    });
    expect(created.status).toBe(201);
    expect(created.json.number).toMatch(/^REQ-/);
    const list = await call(requestsRoute.GET, { path: '/api/requests?priority=HIGH&page=1&pageSize=5', cookie });
    expect(list.status).toBe(200);
    expect(list.json.items.map((i: { id: string }) => i.id)).toEqual([created.json.id]);
    expect(list.json.pageSize).toBe(5);
    const bad = await call(requestsRoute.GET, { path: '/api/requests?page=abc', cookie });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe('VALIDATION');
  });

  it('invalid transition is 409', async () => {
    const request = await createRequest(f.officer, {
      clientId: f.clientId,
      scopeCode: 'QMS',
      objectScope: 'Steel pipes',
      priority: 'NORMAL',
    });
    const doc = await prepareDocument(f.officer, request.id);
    const r = await call(signRoute.POST, {
      method: 'POST',
      path: `/api/documents/${doc.id}/sign`,
      cookie: await sessionCookie(f.signatory.userId, f.signatory.role),
      params: { id: doc.id },
    });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('INVALID_TRANSITION');
  });

  it('document queue param is passed through', async () => {
    const r = await call(documentsRoute.GET, {
      path: '/api/documents?queue=nope',
      cookie: await sessionCookie(f.verifier.userId, f.verifier.role),
    });
    expect(r.status).toBe(400);
  });

  it('public certificate endpoint works without session', async () => {
    const { certificate } = await issueOne(f);
    const ok = await call(publicCertRoute.GET, {
      path: `/api/public/certificates/${certificate.number}`,
      params: { number: certificate.number },
    });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ number: certificate.number, displayStatus: 'ACTIVE' });
    expect(ok.json.verificationToken).toBeUndefined();
    const missing = await call(publicCertRoute.GET, { path: '/api/public/certificates/X', params: { number: 'X' } });
    expect(missing.status).toBe(404);
    expect(missing.json.error.code).toBe('NOT_FOUND');
  });

  it('login-options is public', async () => {
    const r = await call(loginOptionsRoute.GET, { path: '/api/login-options' });
    expect(r.status).toBe(200);
    expect(r.json.map((o: { role: string }) => o.role)).toContain('ISSUANCE_OFFICER');
  });
});

describe('session', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  it('GET without a session is 401', async () => {
    const r = await call(sessionRoute.GET, { path: '/api/session' });
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST logs in, sets an httpOnly jmu_session cookie, and GET returns the session', async () => {
    const login = await call(sessionRoute.POST, {
      method: 'POST',
      path: '/api/session',
      body: { userId: f.officer.userId, role: 'ISSUANCE_OFFICER' },
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^jmu_session=/);
    expect(setCookie.toLowerCase()).toContain('httponly');
    const cookie = setCookie.split(';')[0];
    const me = await call(sessionRoute.GET, { path: '/api/session', cookie });
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({
      user: { id: f.officer.userId, name: 'Test officer' },
      role: 'ISSUANCE_OFFICER',
      roles: ['ISSUANCE_OFFICER'],
      assignmentStatus: 'ACTIVE',
      scopeCodes: ['CE', 'INS', 'ISMS', 'QMS'],
      permissions: [...ROLE_ACTIONS.ISSUANCE_OFFICER],
    });
  });

  it('POST is 403 unless the assignment is ACTIVE or RESTRICTED', async () => {
    await prisma.roleAssignment.updateMany({ where: { userId: f.verifier.userId }, data: { status: 'SUSPENDED' } });
    const r = await call(sessionRoute.POST, {
      method: 'POST',
      path: '/api/session',
      body: { userId: f.verifier.userId, role: 'DOCUMENT_VERIFIER' },
    });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('FORBIDDEN');
    expect(r.headers.get('set-cookie')).toBeNull();
    const noRole = await call(sessionRoute.POST, {
      method: 'POST',
      path: '/api/session',
      body: { userId: f.officer.userId, role: 'SYSTEM_ADMIN' },
    });
    expect(noRole.status).toBe(403);
    await prisma.roleAssignment.updateMany({ where: { userId: f.verifier.userId }, data: { status: 'RESTRICTED' } });
    const restricted = await call(sessionRoute.POST, {
      method: 'POST',
      path: '/api/session',
      body: { userId: f.verifier.userId, role: 'DOCUMENT_VERIFIER' },
    });
    expect(restricted.status).toBe(200);
  });

  it('POST with a bad body is 400', async () => {
    const r = await call(sessionRoute.POST, { method: 'POST', path: '/api/session', body: { userId: 'x', role: 'KING' } });
    expect(r.status).toBe(400);
  });

  it('GET reports no permissions when the assignment was suspended after login', async () => {
    const cookie = await sessionCookie(f.officer.userId, f.officer.role);
    await prisma.roleAssignment.updateMany({ where: { userId: f.officer.userId }, data: { status: 'SUSPENDED' } });
    const me = await call(sessionRoute.GET, { path: '/api/session', cookie });
    expect(me.status).toBe(200);
    expect(me.json.assignmentStatus).toBe('SUSPENDED');
    expect(me.json.permissions).toEqual([]);
  });

  it('DELETE clears the cookie', async () => {
    const r = await call(sessionRoute.DELETE, {
      method: 'DELETE',
      path: '/api/session',
      cookie: await sessionCookie(f.officer.userId, f.officer.role),
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie') ?? '').toMatch(/^jmu_session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });
});

describe('registrations (multipart) and notifications', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'jmu-api-storage-'));
    process.env.STORAGE_DIR = path.join(dir, 'storage');
    await resetDb();
    f = await seedMinimal();
  });
  afterEach(async () => {
    delete process.env.STORAGE_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  const payload = {
    role: 'DOCUMENT_VERIFIER',
    scopes: ['QMS'],
    personal: {
      fullName: 'Rina Wijaya',
      employeeId: 'EMP-001',
      nationalId: '3174000000000001',
      position: 'Senior Auditor',
      unit: 'Certification',
      email: 'rina@jmu.example',
      phone: '+62 812 0000 0000',
    },
    employment: {
      education: 'S1',
      fieldOfStudy: 'Industrial Engineering',
      experienceYears: 6,
      employmentStatus: 'PERMANENT',
      startDate: '2020-01-15',
    },
    declarationAccepted: true,
  };

  function form(slots = REQUIRED_CONTROL_DOCUMENTS.length) {
    const fd = new FormData();
    fd.set('payload', JSON.stringify(payload));
    for (let i = 1; i <= slots; i++) {
      fd.set(`file${i}`, new File([new TextEncoder().encode('%PDF-1.4\nhello')], `doc-${i}.pdf`, { type: 'application/pdf' }));
    }
    return fd;
  }

  it('POST /api/registrations accepts multipart without a session (201)', async () => {
    const r = await call(registrationsRoute.POST, { method: 'POST', path: '/api/registrations', form: form() });
    expect(r.status).toBe(201);
    expect(r.json.applicationId).toEqual(expect.any(String));
    const app = await prisma.registrationApplication.findUniqueOrThrow({
      where: { id: r.json.applicationId },
      include: { documents: true },
    });
    expect(app.documents).toHaveLength(7);
  });

  it('POST /api/registrations with a missing file or payload is 400', async () => {
    const r = await call(registrationsRoute.POST, { method: 'POST', path: '/api/registrations', form: form(6) });
    expect(r.status).toBe(400);
    const fd = form();
    fd.set('payload', '{oops');
    const bad = await call(registrationsRoute.POST, { method: 'POST', path: '/api/registrations', form: fd });
    expect(bad.status).toBe(400);
  });

  it('notifications: lists those for the user or role and marks them read', async () => {
    await issueOne(f); // notifies the preparer (officer) and the ISSUANCE_MANAGER role
    const cookie = await sessionCookie(f.manager.userId, f.manager.role);
    const list = await call(notificationsRoute.GET, { path: '/api/notifications', cookie });
    expect(list.status).toBe(200);
    expect(list.json.items).toHaveLength(1);
    expect(list.json.unread).toBe(1);
    const adminList = await call(notificationsRoute.GET, {
      path: '/api/notifications',
      cookie: await sessionCookie(f.admin.userId, f.admin.role),
    });
    expect(adminList.json.items).toHaveLength(0);
    const read = await call(notificationsReadRoute.POST, { method: 'POST', path: '/api/notifications/read', cookie, body: {} });
    expect(read.status).toBe(200);
    expect(read.json.unread).toBe(0);
    expect(read.json.items[0].read).toBe(true);
  });
});

describe('withActor error mapping', () => {
  beforeEach(async () => {
    await resetDb();
    f = await seedMinimal();
  });

  const run = async (err: unknown) => {
    const h = withActor(async () => {
      throw err;
    });
    return call(h as Handler, { cookie: await sessionCookie(f.officer.userId, f.officer.role) });
  };

  it.each([
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['VALIDATION', 400],
    ['INVALID_TRANSITION', 409],
    ['CONFLICT', 409],
    ['UNAUTHENTICATED', 401],
  ] as const)('DomainError %s -> %i', async (code, status) => {
    const r = await run(new DomainError(code, 'boom'));
    expect(r.status).toBe(status);
    expect(r.json).toEqual({ error: { code, message: 'boom' } });
  });

  it('SQLite busy / Prisma transaction conflict -> 409 CONFLICT', async () => {
    expect((await run(new Error('SQLITE_BUSY: database is locked'))).json.error.code).toBe('CONFLICT');
    expect((await run(Object.assign(new Error('Transaction failed'), { code: 'P2034' }))).status).toBe(409);
  });

  it('anything else -> 500 INTERNAL without leaking the message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await run(new Error('secret internals'));
    expect(r.status).toBe(500);
    expect(r.json).toEqual({ error: { code: 'INTERNAL', message: 'Unexpected error' } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('OpenAPI contract', () => {
  const root = path.resolve(__dirname, '..', '..');
  const spec = parseYaml(fs.readFileSync(path.join(root, 'docs', 'api', 'openapi.yaml'), 'utf8')) as {
    openapi: string;
    paths: Record<string, Record<string, unknown>>;
  };

  function routeFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return routeFiles(p);
      return e.name === 'route.ts' ? [p] : [];
    });
  }

  const files = routeFiles(path.join(root, 'app', 'api'));
  const toApiPath = (file: string) =>
    '/' +
    path
      .relative(path.join(root, 'app'), path.dirname(file))
      .split(path.sep)
      .map((seg) => seg.replace(/^\[(.+)\]$/, '{$1}'))
      .join('/');

  it('is OpenAPI 3.1', () => {
    expect(spec.openapi).toMatch(/^3\.1/);
  });

  it('openapi lists every route file', () => {
    expect(files.length).toBeGreaterThan(20);
    const missing = files.map(toApiPath).filter((p) => !spec.paths[p]);
    expect(missing).toEqual([]);
  });

  it('documents exactly the HTTP methods each route file exports', async () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const file of files) {
      const spec_ = `@app/${path.relative(path.join(root, 'app'), file).split(path.sep).join('/').replace(/\.ts$/, '')}`;
      const mod = (await import(/* @vite-ignore */ spec_)) as Record<string, unknown>;
      const exported = methods.filter((m) => typeof mod[m] === 'function').sort();
      const documented = Object.keys(spec.paths[toApiPath(file)] ?? {})
        .map((k) => k.toUpperCase())
        .filter((k) => methods.includes(k))
        .sort();
      expect(documented, toApiPath(file)).toEqual(exported);
    }
  });
});
