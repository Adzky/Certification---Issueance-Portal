import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const STEPS = ['Select Role', 'Role Review & Requirements', 'Register & Authorisation', 'Access to Dashboard'] as const;
export type StepNumber = 1 | 2 | 3 | 4;

/** Top progress strip: Select Role -> Role Review -> Register & Authorisation -> Access to Dashboard. */
export function Stepper({ current, allDone }: { current: StepNumber; allDone?: boolean }) {
  return (
    <ol aria-label="Registration steps" className="grid grid-cols-2 gap-1.5 rounded-xl bg-white/70 p-1.5 shadow-[0_1px_3px_rgb(15_23_42/0.06)] ring-1 ring-border lg:grid-cols-4">
      {STEPS.map((label, i) => {
        const n = (i + 1) as StepNumber;
        const done = allDone ? true : n < current;
        const active = n === current && !allDone;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold',
              active ? 'bg-primary text-primary-foreground shadow-sm' : done ? 'bg-white text-foreground' : 'bg-muted/70 text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                active ? 'bg-white text-primary' : done ? 'bg-primary text-white' : 'bg-slate-300 text-white',
              )}
            >
              {done && !active ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : n}
            </span>
            <span className="min-w-0 truncate">{label}</span>
            {done && !active && <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** Page title block under the stepper: outlined icon, heading and subtitle. */
export function StepTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <Icon className="size-11 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
