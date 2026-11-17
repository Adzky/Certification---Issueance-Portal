/**
 * Sidebar navigation per role, and the page-access rules derived from it (ruling R5:
 * the root `proxy.ts` redirects a role away from any page that is not in its nav).
 */
import {
  Activity,
  BarChart3,
  BookCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePen,
  FileSignature,
  FileText,
  FileX2,
  History,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  PenTool,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Role } from './types';

export interface NavItem {
  label: string;
  /** Pathname, optionally with a `?view=` query selecting a variant of the same page. */
  href: string;
  icon: LucideIcon;
  /** Not built in the demo: the page renders the "Available in full release" panel. */
  stub?: true;
}

const DASHBOARD: NavItem = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard };
const AUDIT: NavItem = { label: 'Audit Trail', href: '/audit', icon: History };
const ISSUED: NavItem = { label: 'Issued Certificates', href: '/certificates', icon: FileCheck2 };
const REQUESTS: NavItem = { label: 'Issuance Requests', href: '/requests', icon: ClipboardList };

export const NAV: Record<Role, readonly NavItem[]> = {
  ISSUANCE_OFFICER: [
    DASHBOARD,
    REQUESTS,
    { label: 'Draft Documents', href: '/drafts', icon: FilePen },
    { label: 'Templates', href: '/templates', icon: LayoutTemplate, stub: true },
    ISSUED,
    AUDIT,
  ],
  DOCUMENT_VERIFIER: [
    DASHBOARD,
    { label: 'Verification Queue', href: '/verification', icon: ClipboardCheck },
    { label: 'Verification History', href: '/verification?view=history', icon: BookCheck },
    { label: 'Returned Documents', href: '/verification?view=returned', icon: FileX2 },
    AUDIT,
  ],
  AUTHORISED_SIGNATORY: [
    DASHBOARD,
    { label: 'Signing Queue', href: '/signing', icon: FileSignature },
    { label: 'Signed Documents', href: '/signing?view=signed', icon: FileText },
    { label: 'Signature Settings', href: '/signature-settings', icon: PenTool, stub: true },
    AUDIT,
  ],
  ISSUANCE_MANAGER: [
    DASHBOARD,
    REQUESTS,
    { label: 'Workflow Monitoring', href: '/workflow', icon: Activity, stub: true },
    { label: 'Certificate Registry', href: '/registry', icon: ScrollText, stub: true },
    ISSUED,
    { label: 'Validity & Lifecycle', href: '/lifecycle', icon: CalendarClock, stub: true },
    { label: 'Pending Authorisations', href: '/authorisations', icon: UserCheck },
    { label: 'Reports & Analytics', href: '/reports', icon: BarChart3, stub: true },
    AUDIT,
  ],
  SYSTEM_ADMIN: [
    DASHBOARD,
    { label: 'User & Role Management', href: '/users', icon: Users },
    { label: 'Permission Matrix', href: '/settings/permissions', icon: ShieldCheck },
    { label: 'Template Management', href: '/templates', icon: LayoutTemplate, stub: true },
    { label: 'Settings', href: '/settings', icon: Settings },
    AUDIT,
  ],
};

const pathOf = (href: string) => href.split('?')[0];
const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Distinct pathnames the role may open (nav hrefs without query), always including `/dashboard`. */
export function allowedPaths(role: Role): string[] {
  return [...new Set(['/dashboard', ...NAV[role].map((i) => pathOf(i.href))])];
}

/** True when `pathname` is one of the role's pages or a sub-page of one (e.g. `/drafts/x/edit`). */
export function isPathAllowed(role: Role, pathname: string): boolean {
  const p = trimSlash(pathname);
  return allowedPaths(role).some((base) => within(p, base));
}

/** The role's nav item whose pathname is exactly `pathname` (first match; query variants ignored). */
export function findNavItem(role: Role, pathname: string): NavItem | undefined {
  const p = trimSlash(pathname);
  return NAV[role].find((i) => pathOf(i.href) === p);
}

/**
 * The nav item for the current page: a `?view=x` item when that view is open, otherwise the
 * plain item with the longest pathname containing the page (`/settings/permissions` beats `/settings`).
 */
export function activeNavItem(items: readonly NavItem[], pathname: string, search: URLSearchParams): NavItem | undefined {
  const p = trimSlash(pathname);
  const view = search.get('view');
  const viewItem = items.find((i) => {
    const [base, query] = i.href.split('?');
    return !!query && base === p && new URLSearchParams(query).get('view') === view;
  });
  if (viewItem) return viewItem;
  return items
    .filter((i) => !i.href.includes('?') && within(p, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
