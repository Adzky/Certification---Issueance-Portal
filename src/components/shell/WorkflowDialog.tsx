'use client';

import { ArrowRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ROLE_META, ROLE_ORDER } from '@/lib/roles';
import { TONE_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils';

const STAGE_BG: Record<string, string> = {
  blue: 'bg-tone-blue-soft/70 border-tone-blue/15',
  green: 'bg-tone-green-soft/70 border-tone-green/15',
  purple: 'bg-tone-purple-soft/70 border-tone-purple/15',
  amber: 'bg-tone-amber-soft/70 border-tone-amber/15',
  grey: 'bg-tone-grey-soft border-tone-grey/15',
  red: 'bg-tone-red-soft/70 border-tone-red/15',
};

/** The five-stage end-to-end issuance flow (Officer → Verifier → Signatory → Manager → Admin). */
export function WorkflowDiagram() {
  return (
    <ol className="flex flex-col items-stretch gap-2 md:flex-row">
      {ROLE_ORDER.map((role, i) => {
        const m = ROLE_META[role];
        const Icon = m.icon;
        return (
          <Fragment key={role}>
            {i > 0 && (
              <li aria-hidden className="flex shrink-0 items-center justify-center">
                <ArrowRight className="size-5 rotate-90 text-primary md:rotate-0" />
              </li>
            )}
            <li
              className={cn(
                'flex flex-col items-center rounded-xl border px-3 py-4 text-center md:min-w-0 md:flex-1 md:basis-0',
                STAGE_BG[m.tone],
              )}
            >
              <Icon className={cn('mb-2 size-8', TONE_CLASSES[m.tone].text)} strokeWidth={1.75} aria-hidden />
              <p className="text-sm font-bold text-foreground">{m.label}</p>
              <p className="text-xs font-medium text-foreground/80">({m.stage})</p>
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{m.stageDescription}</p>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Dialog wrapper around {@link WorkflowDiagram}; `children` is the trigger. */
export function WorkflowDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Certification &amp; Issuance Workflow (End-to-End)</DialogTitle>
          <DialogDescription>Every certificate and inspection report passes through these five roles.</DialogDescription>
        </DialogHeader>
        <WorkflowDiagram />
      </DialogContent>
    </Dialog>
  );
}
