'use client';

import {
  Award,
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  Code,
  Coins,
  Database,
  FileClock,
  FileText,
  Globe,
  Info,
  Layers,
  LockKeyhole,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { StubPanel } from '@/components/common/StubPanel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface SettingsCard {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Implemented cards link to their page; the rest open the "available in full release" panel. */
  href?: string;
}

export const SETTINGS_CARDS: readonly SettingsCard[] = [
  { title: 'General Settings', description: 'Manage portal name, logo, contact, time zone and system preferences.', icon: SlidersHorizontal },
  { title: 'User Management', description: 'Manage users, roles and access permissions.', icon: Users, href: '/users' },
  { title: 'Role & Permissions', description: 'Define roles, menus and access rights for each role.', icon: ShieldCheck, href: '/settings/permissions' },
  { title: 'Organization Settings', description: 'Manage client/organization data, categories and verification rules.', icon: Building2 },
  { title: 'Service Configuration', description: 'Configure service types, schemes, scopes and workflow.', icon: Layers },
  { title: 'Workflow & Approval', description: 'Set approval flow, stages, SLA and auto actions (e.g. invoice, issuance).', icon: Workflow },
  { title: 'Document & Template', description: 'Manage certificate, report, form, letter and other document templates.', icon: FileText },
  { title: 'Certification Settings', description: 'Configure certificate numbering, validity period and lifecycle rules.', icon: Award },
  { title: 'Inspection Settings', description: 'Configure inspection types, checklists, resources and pricing parameters.', icon: ClipboardList },
  { title: 'Pricing & Billing', description: 'Manage service prices, cost components, invoice settings and payment instructions.', icon: Coins },
  { title: 'Notification Settings', description: 'Configure email, in-app and reminder notifications (e.g. expiry, approval, payment).', icon: Bell },
  { title: 'Master Data', description: 'Manage reference data (standards, regions, countries, cities, product categories).', icon: Globe },
  { title: 'Integrations', description: 'Configure external integrations (e.g. email, payment, SSO, API).', icon: Share2 },
  { title: 'Data Management', description: 'Backup, restore and data maintenance (e.g. import/export, data cleanup).', icon: Database },
  { title: 'Security & Compliance', description: 'Configure security policy, login settings, password policy and compliance controls.', icon: LockKeyhole },
  { title: 'System Parameters', description: 'Advanced system configuration (e.g. code prefix, numbering, system limits).', icon: Code },
  { title: 'Logs & Maintenance', description: 'View system logs, error logs and perform maintenance tasks.', icon: FileClock },
  { title: 'About System', description: 'System information, version, license and update management.', icon: Info },
];

const cardClass =
  'group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-[0_1px_3px_rgb(15_23_42/0.05)] transition hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring';

function CardBody({ card }: { card: SettingsCard }) {
  const Icon = card.icon;
  return (
    <>
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-tone-blue-soft text-primary">
        <Icon className="size-7" strokeWidth={1.7} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{card.title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{card.description}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  );
}

/** Admin Settings hub: 18 cards; two link to real pages, the rest open a stub dialog. */
export function SettingsHub() {
  const [open, setOpen] = useState<SettingsCard | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Configure system preferences, master data, users, permissions and operational parameters for the certification portal."
      />
      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {SETTINGS_CARDS.map((card) => (
          <li key={card.title}>
            {card.href ? (
              <Link href={card.href} className={cardClass}>
                <CardBody card={card} />
              </Link>
            ) : (
              <button type="button" className={cardClass} onClick={() => setOpen(card)}>
                <CardBody card={card} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="sr-only">{open?.title}</DialogTitle>
          <DialogDescription className="sr-only">This module is part of the full release.</DialogDescription>
          {open && <StubPanel title={open.title} description={open.description} className="border-0 shadow-none" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
