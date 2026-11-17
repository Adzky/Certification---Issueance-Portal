import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, type Tone } from '@/lib/tones';

/** A KPI tile: tinted icon square + big number + label (dashboards and list-page headers). */
export interface StatCardProps {
  /** Lucide icon shown in the tinted tile. */
  icon: LucideIcon;
  /** Colour of the icon tile. */
  tone: Tone;
  /** The figure, e.g. `120` or `"92%"`. */
  value: ReactNode;
  /** Caption under the value, e.g. "Total Requests". */
  label: string;
  /** Optional small line under the label (e.g. "within 7 days"). */
  hint?: string;
  /** Makes the card a button (e.g. to filter the list below by this status). */
  onClick?: () => void;
  /** Highlights the card (e.g. the active status filter). */
  active?: boolean;
  className?: string;
}

export function StatCard({ icon: Icon, tone, value, label, hint, onClick, active, className }: StatCardProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-[0_1px_3px_rgb(15_23_42/0.05)]',
        onClick && 'cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring',
        active && 'border-primary ring-1 ring-primary/30',
        className,
      )}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[tone].tile)}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-tight font-bold tracking-tight text-foreground">{value}</span>
        <span className="block text-[13px] leading-tight text-muted-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
      </span>
    </Comp>
  );
}
