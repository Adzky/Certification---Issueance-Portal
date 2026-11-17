'use client';

import { ArrowRight, Check, Gavel, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { REGISTRABLE_ROLES, ROLE_CONTENT } from '@/domain/roleContent';
import type { Role } from '@/domain/types';
import { ROLE_META } from '@/lib/roles';
import { TONE_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Step 1: pick one of the five registrable roles. */
export function SelectRole() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  return (
    <div className="space-y-4">
      <ul aria-label="Roles" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REGISTRABLE_ROLES.map((r) => {
          const meta = ROLE_META[r];
          const Icon = meta.icon;
          const selected = role === r;
          return (
            <li key={r}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setRole(r)}
                className={cn(
                  'relative flex h-full w-full items-start gap-4 rounded-xl border bg-card p-4 text-left shadow-[0_1px_3px_rgb(15_23_42/0.05)] transition hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring',
                  selected && 'border-primary ring-2 ring-primary/40',
                )}
              >
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[meta.tone].tile)}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold">{meta.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{ROLE_CONTENT[r].coreResponsibility}</span>
                </span>
                {selected && <Check className="absolute top-3 right-3 size-6 rounded-full bg-primary p-1 text-white" aria-hidden />}
              </button>
            </li>
          );
        })}
        <li>
          <section
            aria-label="Certification Decision Maker (information)"
            className="flex h-full items-start gap-4 rounded-xl border border-dashed border-tone-purple/40 bg-tone-purple-soft/60 p-4"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-tone-purple">
              <Gavel className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold">Certification Decision Maker</span>
              <span className="block text-xs font-medium text-tone-purple">(Technical Decision Authority)</span>
              <span className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Information only. This separate role takes certification decisions and cannot be selected here.
              </span>
            </span>
          </section>
        </li>
      </ul>
      <div className="flex justify-end">
        <Button size="lg" disabled={!role} onClick={() => role && router.push(`/register/2?role=${role}`)} className="h-11 px-6">
          Continue to Role Review <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
