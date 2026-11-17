'use client';

import { createColumnHelper, tableFeatures, useTable, type RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc';

/** Current server-side sort. */
export interface SortState {
  key: string;
  dir: SortDir;
}

/** One column of a {@link DataTable}. */
export interface DataTableColumn<T> {
  /** Unique column id. */
  id: string;
  /** Header content. */
  header: ReactNode;
  /** Cell content for a row. */
  cell: (row: T) => ReactNode;
  /** Server sort key (the API's `sort` param); omit for an unsortable column. */
  sortKey?: string;
  /** Extra classes for the header and body cells (width, alignment). */
  className?: string;
}

/** Server-paginated, server-sorted table with row selection and a "Showing a – b of N" footer. */
export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  /** Rows of the current page only. */
  data: readonly T[];
  /** Total rows across all pages. */
  total: number;
  /** 1-based page number. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Rows-per-page change (10/20/50); the caller should reset to page 1. Omit to hide the selector. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Current sort, highlighted in the header. */
  sort?: SortState | null;
  /** Called when a sortable header is clicked (toggles asc → desc). */
  onSort?: (sort: SortState) => void;
  /** Id of the highlighted row. */
  selectedId?: string | null;
  /** Row click handler (selects the row). */
  onSelect?: (row: T) => void;
  /** Row id (default: `row.id`). */
  getRowId?: (row: T) => string;
  /** Plural noun for the footer, e.g. "requests" → "Showing 1 – 10 of 120 requests". */
  noun?: string;
  /** Shows a loading row instead of data. */
  loading?: boolean;
  /** Shown when there are no rows. */
  empty?: ReactNode;
  /** Accessible table name. */
  ariaLabel?: string;
  className?: string;
}

export const PAGE_SIZES = [10, 20, 50] as const;

const features = tableFeatures({});
const defaultRowId = (row: unknown) => String((row as { id: unknown }).id);

export function DataTable<T extends RowData>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sort,
  onSort,
  selectedId,
  onSelect,
  getRowId = defaultRowId,
  noun = 'items',
  loading,
  empty,
  ariaLabel,
  className,
}: DataTableProps<T>) {
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns(
      columns.map((c) => helper.display({ id: c.id, header: () => c.header, cell: (ctx) => c.cell(ctx.row.original) })),
    );
  }, [columns]);
  const rows = useMemo(() => [...data], [data]);
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => getRowId(row),
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const toggleSort = (key: string) =>
    onSort?.({ key, dir: sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc' });

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={ariaLabel}>
          <thead className="bg-[#f7f9fd]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b">
                {group.headers.map((header) => {
                  const col = byId.get(header.column.id)!;
                  const active = !!col.sortKey && sort?.key === col.sortKey;
                  const SortIcon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn('h-11 px-3 text-left text-xs font-semibold whitespace-nowrap text-foreground', col.className)}
                    >
                      {col.sortKey && onSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.sortKey!)}
                          className="inline-flex items-center gap-1 rounded hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <table.FlexRender header={header} />
                          <SortIcon className={cn('size-3.5', active ? 'text-primary' : 'text-muted-foreground/60')} aria-hidden />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  {empty ?? 'No records found.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const selected = selectedId != null && row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    data-state={selected ? 'selected' : undefined}
                    aria-selected={onSelect ? selected : undefined}
                    onClick={onSelect ? () => onSelect(row.original) : undefined}
                    className={cn(
                      'border-b transition-colors last:border-b-0',
                      onSelect && 'cursor-pointer hover:bg-[#f7f9fd]',
                      selected && 'bg-tone-blue-soft/70 hover:bg-tone-blue-soft/70',
                    )}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className={cn('px-3 py-3 align-middle', byId.get(cell.column.id)!.className)}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          Showing {from} – {to} of {total} {noun}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {onPageSizeChange && (
            <label className="flex items-center gap-2 text-muted-foreground">
              Rows per page
              <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                <SelectTrigger size="sm" aria-label="Rows per page" className="w-[4.5rem] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} />
        </div>
      </div>
    </div>
  );
}

/** Page numbers with ellipses: 1 … 4 5 6 … 15. */
function pageWindow(page: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => set.add(n));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

function Pager({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>
      {pageWindow(page, pageCount).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="icon-sm"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
