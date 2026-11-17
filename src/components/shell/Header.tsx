'use client';

import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import type { SessionInfo } from '@/contract/types';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { RoleBadge } from './RoleBadge';
import { UserMenu } from './UserMenu';
import { WorkflowDialog } from './WorkflowDialog';

/** White top bar: logo, role pill, notifications, help (workflow overview) and user menu. */
export function Header({ session }: { session: SessionInfo }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 shadow-[0_1px_3px_rgb(15_23_42/0.06)]">
      <Link href="/dashboard" className="flex w-56 shrink-0 items-center" aria-label="JMU Sertifikasi – Dashboard">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand asset */}
        <img src="/brand/logo.svg" alt="JMU Sertifikasi – Certification & Issuance Portal" className="h-10 w-auto" />
      </Link>
      <RoleBadge role={session.role} />
      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell />
        <WorkflowDialog>
          <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Help">
            <CircleHelp className="size-5" />
          </Button>
        </WorkflowDialog>
        <span className="mx-1 h-8 w-px bg-border" aria-hidden />
        <UserMenu session={session} />
      </div>
    </header>
  );
}
