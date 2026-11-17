'use client';

import { Check, CircleCheck, CircleMinus, CirclePause, CircleX, Clock3, Info, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { AUTHORISATION_STATUS_DEFINITIONS, REGISTRABLE_ROLES } from '@/domain/roleContent';
import type { Role } from '@/domain/types';
import { ROLE_META } from '@/lib/roles';
import { cn } from '@/lib/utils';

export type SectionKey = 'personal' | 'scope' | 'competency' | 'documents' | 'authorisation' | 'declaration';

/** Sub-steps of step 3, shared with the form's section tabs. */
export const SECTIONS: readonly { key: SectionKey; sidebarLabel: string; tabLabel: string }[] = [
  { key: 'personal', sidebarLabel: 'Personal Information', tabLabel: 'Personal Information' },
  { key: 'scope', sidebarLabel: 'Role & Service Scope', tabLabel: 'Role & Service Scope' },
  { key: 'competency', sidebarLabel: 'Competency & Experience', tabLabel: 'Competency & Experience' },
  { key: 'documents', sidebarLabel: 'Upload Control Documents', tabLabel: 'Control Documents' },
  { key: 'authorisation', sidebarLabel: 'Authorisation Details', tabLabel: 'Authorisation Details' },
  { key: 'declaration', sidebarLabel: 'Declaration & Submission', tabLabel: 'Declaration' },
];

const LEGEND_ICON: Record<string, { icon: typeof CircleCheck; className: string }> = {
  ACTIVE: { icon: CircleCheck, className: 'text-tone-green' },
  RESTRICTED: { icon: CircleMinus, className: 'text-amber-500' },
  SUSPENDED: { icon: CirclePause, className: 'text-slate-500' },
  REVOKED: { icon: CircleX, className: 'text-tone-red' },
  EXPIRED: { icon: Clock3, className: 'text-slate-400' },
};

/** Compact status legend ("Authorisation Result" on step 3, "Authorisation Status Guide" on step 4). */
export function StatusLegend({ title }: { title: string }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.07]">
      <h2 className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-white">
        <Info className="size-4" aria-hidden /> {title}
      </h2>
      <ul className="space-y-2 bg-white px-3 py-3 text-xs text-slate-700">
        {AUTHORISATION_STATUS_DEFINITIONS.map((d) => {
          const { icon: Icon, className } = LEGEND_ICON[d.status]!;
          return (
            <li key={d.status} className="flex items-start gap-2">
              <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden />
              <span>
                <strong className="text-slate-900">{d.short}</strong> – {d.detail}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Intro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl leading-tight font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-navy-foreground">{children}</p>
    </div>
  );
}

function SubSteps({ items, active, allDone }: { items: readonly { key: string; label: string }[]; active?: string; allDone?: boolean }) {
  return (
    <ol className="relative space-y-1" aria-label="Progress">
      {items.map((it, i) => {
        const current = it.key === active;
        const done = allDone ? !current : false;
        return (
          <li key={it.key} className="relative">
            {i < items.length - 1 && <span className="absolute top-8 left-[1.15rem] h-4 w-px bg-white/25" aria-hidden />}
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium',
                current ? 'bg-white/90 text-navy shadow' : 'text-white',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  done ? 'bg-tone-green text-white' : current ? 'bg-primary text-white' : 'bg-slate-400/70 text-white',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : current && it.key === 'dashboard' ? <Monitor className="size-3.5" aria-hidden /> : null}
              </span>
              {it.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DecisionMakerNote() {
  return (
    <section aria-label="Note" className="rounded-xl border border-white/20 bg-gradient-to-b from-white/15 to-white/5 p-4 text-sm leading-relaxed text-navy-foreground">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
        <Info className="size-4" aria-hidden /> Note
      </h2>
      The Certification Decision Maker (Technical Decision Authority) is a separate functional role responsible for certification decisions
      such as grant, maintain, suspend or withdraw. It is not part of this registration.
    </section>
  );
}

export type SidebarProps =
  | { step: 1 }
  | { step: 2; role: Role; onSelectRole: (role: Role) => void }
  | { step: 3; section: SectionKey }
  | { step: 4; approved?: boolean };

/** Left navy panel: intro text plus the step-specific list (roles, sub-steps) and status legend. */
export function OnboardingSidebar(props: SidebarProps) {
  return (
    <aside
      aria-label="Registration guide"
      className="flex shrink-0 flex-col gap-6 bg-gradient-to-b from-navy to-[#0a1a40] px-5 py-7 lg:w-72 lg:self-stretch"
    >
      {props.step === 1 && (
        <>
          <Intro title="Choose Your Role">Select the role you will perform in the Certification &amp; Issuance process.</Intro>
          <DecisionMakerNote />
        </>
      )}
      {props.step === 2 && (
        <>
          <Intro title="Choose Your Role">Select the role you will perform in the Certification &amp; Issuance process.</Intro>
          <ul aria-label="Roles" className="space-y-2.5">
            {REGISTRABLE_ROLES.map((r) => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              const selected = r === props.role;
              return (
                <li key={r}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => props.onSelectRole(r)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                      selected ? 'bg-white text-navy shadow-lg ring-2 ring-primary' : 'bg-white/90 text-navy hover:bg-white',
                    )}
                  >
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1">{meta.label}</span>
                    {selected && <Check className="size-5 rounded-full bg-primary p-0.5 text-white" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <DecisionMakerNote />
        </>
      )}
      {props.step === 3 && (
        <>
          <Intro title="Registration & Authorisation">Complete your registration, submit the required documents and obtain role authorisation.</Intro>
          <SubSteps items={SECTIONS.map((s) => ({ key: s.key, label: s.sidebarLabel }))} active={props.section} />
          <StatusLegend title="Authorisation Result" />
        </>
      )}
      {props.step === 4 && (
        <>
          <Intro title="Access to Dashboard">
            {props.approved
              ? 'Your registration and authorisation are complete. Access your dashboard based on the assigned role and permissions.'
              : 'Your registration has been submitted. Once the Issuance Manager approves it you can access your dashboard.'}
          </Intro>
          <SubSteps
            allDone
            active="dashboard"
            items={[...SECTIONS.map((s) => ({ key: s.key, label: s.sidebarLabel })), { key: 'dashboard', label: 'Access to Dashboard' }]}
          />
          <StatusLegend title="Authorisation Status Guide" />
        </>
      )}
    </aside>
  );
}
