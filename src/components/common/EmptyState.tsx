import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Centered placeholder for an empty list, a missing selection or an unavailable page. */
export interface EmptyStateProps {
  /** Icon in the circle (default: inbox). */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Optional button/link below the text. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-tone-blue-soft text-tone-blue">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
