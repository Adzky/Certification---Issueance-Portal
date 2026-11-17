import { describe, expect, it } from 'vitest';
import { allowedPaths, activeNavItem, findNavItem, isPathAllowed, NAV } from '@/domain/nav';
import { ROLES } from '@/domain/permissions';

describe('NAV', () => {
  it('lists the nav items of every role in order', () => {
    expect(NAV.ISSUANCE_OFFICER.map((i) => i.label)).toEqual([
      'Dashboard', 'Issuance Requests', 'Draft Documents', 'Templates', 'Issued Certificates', 'Audit Trail',
    ]);
    expect(NAV.DOCUMENT_VERIFIER.map((i) => i.href)).toEqual([
      '/dashboard', '/verification', '/verification?view=history', '/verification?view=returned', '/audit',
    ]);
    expect(NAV.AUTHORISED_SIGNATORY.map((i) => i.label)).toEqual([
      'Dashboard', 'Signing Queue', 'Signed Documents', 'Signature Settings', 'Audit Trail',
    ]);
    expect(NAV.ISSUANCE_MANAGER.map((i) => i.label)).toEqual([
      'Dashboard', 'Issuance Requests', 'Workflow Monitoring', 'Certificate Registry', 'Issued Certificates',
      'Validity & Lifecycle', 'Pending Authorisations', 'Reports & Analytics', 'Audit Trail',
    ]);
    expect(NAV.SYSTEM_ADMIN.map((i) => i.label)).toEqual([
      'Dashboard', 'User & Role Management', 'Permission Matrix', 'Template Management', 'Settings', 'Audit Trail',
    ]);
  });

  it('marks exactly the stub items', () => {
    const stubs = ROLES.flatMap((r) => NAV[r].filter((i) => i.stub).map((i) => i.label));
    expect(stubs.sort()).toEqual(
      [
        'Templates', 'Signature Settings', 'Workflow Monitoring', 'Certificate Registry', 'Validity & Lifecycle',
        'Reports & Analytics', 'Template Management',
      ].sort(),
    );
  });
});

describe('allowedPaths / isPathAllowed', () => {
  it('derives pathnames (no query) from NAV, always including /dashboard', () => {
    expect(allowedPaths('DOCUMENT_VERIFIER')).toEqual(['/dashboard', '/verification', '/audit']);
    for (const role of ROLES) expect(allowedPaths(role)).toContain('/dashboard');
  });

  it('allows nav pages and their sub-pages for the role only', () => {
    expect(isPathAllowed('ISSUANCE_OFFICER', '/requests')).toBe(true);
    expect(isPathAllowed('ISSUANCE_OFFICER', '/drafts/abc/edit')).toBe(true);
    expect(isPathAllowed('DOCUMENT_VERIFIER', '/requests')).toBe(false);
    expect(isPathAllowed('SYSTEM_ADMIN', '/settings/permissions')).toBe(true);
    expect(isPathAllowed('ISSUANCE_MANAGER', '/settings')).toBe(false);
    expect(isPathAllowed('ISSUANCE_OFFICER', '/requestsx')).toBe(false);
    expect(isPathAllowed('ISSUANCE_OFFICER', '/')).toBe(false);
    expect(isPathAllowed('ISSUANCE_MANAGER', '/reports')).toBe(true);
  });
});

describe('findNavItem / activeNavItem', () => {
  it('finds a role item by pathname, ignoring trailing slash', () => {
    expect(findNavItem('ISSUANCE_MANAGER', '/reports/')?.label).toBe('Reports & Analytics');
    expect(findNavItem('SYSTEM_ADMIN', '/templates')?.label).toBe('Template Management');
    expect(findNavItem('ISSUANCE_OFFICER', '/templates')?.label).toBe('Templates');
    expect(findNavItem('ISSUANCE_OFFICER', '/nope')).toBeUndefined();
  });

  it('picks the ?view= variant when open, else the longest plain match', () => {
    const v = NAV.DOCUMENT_VERIFIER;
    expect(activeNavItem(v, '/verification', new URLSearchParams())?.label).toBe('Verification Queue');
    expect(activeNavItem(v, '/verification', new URLSearchParams('view=history'))?.label).toBe('Verification History');
    expect(activeNavItem(NAV.ISSUANCE_OFFICER, '/drafts/x/edit', new URLSearchParams())?.label).toBe('Draft Documents');
    expect(activeNavItem(NAV.SYSTEM_ADMIN, '/settings/permissions', new URLSearchParams())?.label).toBe('Permission Matrix');
    expect(activeNavItem(NAV.SYSTEM_ADMIN, '/settings', new URLSearchParams())?.label).toBe('Settings');
    expect(activeNavItem(NAV.SYSTEM_ADMIN, '/nope', new URLSearchParams())).toBeUndefined();
  });
});
