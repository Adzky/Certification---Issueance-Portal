import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page title row: outlined icon, title, subtitle and right-aligned actions. */
export interface PageHeaderProps {
  /** Large outlined icon left of the title. */
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  /** Buttons on the right (e.g. "Create Issuance Request"). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {Icon && (
        <span className="flex size-12 shrink-0 items-center justify-center text-primary">
          <Icon className="size-10" strokeWidth={1.6} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
