'use client';

import { FileText, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** One tab of a {@link DetailPanel}. */
export interface DetailTab {
  key: string;
  label: string;
  content: ReactNode;
}

/** Right-hand detail card: icon + title + badge, tab strip, scrollable body, action bar. */
export interface DetailPanelProps {
  /** e.g. "Request Detail". */
  title: string;
  /** Usually the record number, shown as a grey pill at the top right. */
  badge?: ReactNode;
  /** Icon before the title (default: document). */
  icon?: LucideIcon;
  tabs: readonly DetailTab[];
  /** Buttons at the bottom (primary action first). */
  actions?: ReactNode;
  /** Controlled active tab key (defaults to the first tab, uncontrolled). */
  activeTab?: string;
  onTabChange?: (key: string) => void;
  className?: string;
}

export function DetailPanel({ title, badge, icon: Icon = FileText, tabs, actions, activeTab, onTabChange, className }: DetailPanelProps) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]', className)}
    >
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Icon className="size-6 shrink-0 text-primary" strokeWidth={1.8} aria-hidden />
        <h2 className="flex-1 truncate text-lg font-bold">{title}</h2>
        {badge != null && (
          <span className="rounded-full bg-tone-blue-soft px-3 py-1 text-xs font-semibold whitespace-nowrap text-foreground">
            {badge}
          </span>
        )}
      </header>
      <Tabs
        {...(activeTab !== undefined ? { value: activeTab } : { defaultValue: tabs[0]?.key })}
        onValueChange={onTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="px-4">
          <TabsList className="h-10! w-full rounded-lg bg-[#f1f5fb] p-1">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="h-full rounded-md data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="min-h-0 overflow-y-auto px-4 py-3">
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
      {actions && <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3">{actions}</footer>}
    </section>
  );
}

/** Label/value grid used inside detail tabs ("Client : PT Surya Kencana Industri"). */
export interface DetailListProps {
  items: readonly { label: string; value: ReactNode }[];
  className?: string;
}

export function DetailList({ items, className }: DetailListProps) {
  return (
    <dl className={cn('grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 text-sm', className)}>
      {items.map((it) => (
        <div key={it.label} className="col-span-2 grid grid-cols-subgrid border-b py-2 last:border-b-0">
          <dt className="font-semibold text-foreground">{it.label}</dt>
          <dd className="min-w-0 break-words text-foreground/90">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
