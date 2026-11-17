'use client';

import { CalendarDays, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** One dropdown filter. An "All …" option (no value) is added automatically. */
export interface FilterDef {
  /** Key in the {@link FilterValue} (and usually the API query param), e.g. `status`. */
  key: string;
  /** Small caption above the dropdown, e.g. "Status". */
  label: string;
  options: readonly { value: string; label: string }[];
  /** Text of the "no filter" option (default: `All <label>`). */
  allLabel?: string;
}

/** Filter state: `q` (search text), `from`/`to` (yyyy-mm-dd) and one entry per {@link FilterDef} key. */
export type FilterValue = Partial<Record<string, string>>;

/** Search box + dropdown filters + optional date range + Reset. Fully controlled. */
export interface FilterBarProps {
  searchPlaceholder: string;
  filters: readonly FilterDef[];
  value: FilterValue;
  /** Receives the whole new value; Reset sends `{}`. */
  onChange: (value: FilterValue) => void;
  /** Shows from/to date inputs bound to `value.from` / `value.to`. */
  dateRange?: true;
  className?: string;
}

const ALL = '__all__';

export function FilterBar({ searchPlaceholder, filters, value, onChange, dateRange, className }: FilterBarProps) {
  const set = (key: string, v: string | undefined) => onChange({ ...value, [key]: v || undefined });

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)} role="search">
      <div className="relative min-w-60 flex-[2_1_16rem]">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search"
          placeholder={searchPlaceholder}
          value={value.q ?? ''}
          onChange={(e) => set('q', e.target.value)}
          className="h-11 rounded-lg bg-card pl-9 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
        />
      </div>

      {filters.map((f) => (
        <div
          key={f.key}
          className="flex h-11 min-w-40 flex-[1_1_10rem] flex-col justify-center rounded-lg border border-input bg-card px-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
        >
          <span className="text-[10px] leading-tight text-muted-foreground">{f.label}</span>
          <Select value={value[f.key] ?? ALL} onValueChange={(v) => set(f.key, v === ALL ? undefined : v)}>
            <SelectTrigger
              aria-label={f.label}
              className="h-5! w-full border-0 bg-transparent p-0 font-medium shadow-none focus-visible:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{f.allLabel ?? `All ${f.label}`}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {dateRange && (
        <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <input
            type="date"
            aria-label="From date"
            value={value.from ?? ''}
            max={value.to}
            onChange={(e) => set('from', e.target.value)}
            className="bg-transparent outline-none"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            aria-label="To date"
            value={value.to ?? ''}
            min={value.from}
            onChange={(e) => set('to', e.target.value)}
            className="bg-transparent outline-none"
          />
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => onChange({})}
        className="h-11 gap-2 rounded-lg bg-card px-4 font-semibold text-primary shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
      >
        <RotateCcw /> Reset
      </Button>
    </div>
  );
}
