import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Placeholder page body for nav items that are out of scope in the demo. */
export interface StubPanelProps {
  /** Page name, e.g. "Reports & Analytics". */
  title: string;
  /** What the page will do in the full release. */
  description?: string;
  className?: string;
}

export function StubPanel({ title, description, className }: StubPanelProps) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col items-center rounded-xl border bg-card px-6 py-16 text-center shadow-sm', className)}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-tone-purple-soft text-tone-purple">
        <Rocket className="size-7" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 inline-flex items-center rounded-full bg-tone-blue-soft px-3 py-1 text-sm font-medium text-tone-blue">
        Available in full release
      </p>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {description ?? 'This module is part of the full JMU portal and is not included in this demo.'}
      </p>
    </section>
  );
}
