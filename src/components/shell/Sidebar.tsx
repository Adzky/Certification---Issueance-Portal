'use client';

import { ArrowRight, ArrowRightLeft, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { activeNavItem, NAV } from '@/domain/nav';
import type { Role } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useSignOut } from './useSignOut';
import { WorkflowDialog } from './WorkflowDialog';

function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = activeNavItem(NAV[role], pathname, search);
  return <NavList role={role} activeHref={active?.href} />;
}

function NavList({ role, activeHref }: { role: Role; activeHref?: string }) {
  return (
    <ul className="space-y-1">
      {NAV[role].map((item) => {
        const Icon = item.icon;
        const isActive = item.href === activeHref;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-white shadow-[0_4px_12px_rgb(29_78_216/0.45)]'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Navy sidebar: role nav, workflow card and "Switch Role". */
export function Sidebar({ role }: { role: Role }) {
  const signOut = useSignOut();
  return (
    <aside className="sticky top-16 flex h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col bg-gradient-to-b from-navy to-[#0a1a40] text-sidebar-foreground">
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-5">
        <Suspense fallback={<NavList role={role} />}>
          <NavLinks role={role} />
        </Suspense>
      </nav>

      <div className="space-y-3 px-3 pb-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center">
          <ClipboardCheck className="mx-auto mb-2 size-9 text-white" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-snug font-semibold text-white">Certification &amp; Issuance Workflow</p>
          <WorkflowDialog>
            <button
              type="button"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/40 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              View Workflow <ArrowRight className="size-4" aria-hidden />
            </button>
          </WorkflowDialog>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          <ArrowRightLeft className="size-4" aria-hidden />
          Switch Role
        </button>
      </div>
    </aside>
  );
}
