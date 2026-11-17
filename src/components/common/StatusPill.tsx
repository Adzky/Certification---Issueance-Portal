import { cn } from '@/lib/utils';
import { statusLabel, statusTone, type StatusKind } from '@/lib/status';
import { TONE_CLASSES, type Tone } from '@/lib/tones';

/** Coloured status badge. Tone and Title Case label come from the enum value. */
export interface StatusPillProps {
  /** Enum value, e.g. `READY_FOR_SIGNING` or `HIGH`. */
  status: string;
  /** Entity the status belongs to; changes the colour of a few shared values (an issued request is purple). */
  kind?: StatusKind;
  /** Overrides the derived label. */
  label?: string;
  /** Overrides the derived tone. */
  tone?: Tone;
  className?: string;
}

export function StatusPill({ status, kind, label, tone, className }: StatusPillProps) {
  const t = tone ?? statusTone(status, kind);
  return (
    <span
      data-tone={t}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[t].pill,
        className,
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}
