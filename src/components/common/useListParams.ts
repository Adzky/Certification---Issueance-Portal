'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FilterValue } from './FilterBar';
import type { SortState } from './DataTable';

/** URL query keys owned by a list page. */
export interface ListParamsConfig {
  /** Filter keys (besides `q`) mirrored to the URL, e.g. `['status', 'scope']`. */
  filterKeys: readonly string[];
  /** Sort used when the URL has none. */
  defaultSort: SortState;
  /** Sort keys whose first click should be descending (e.g. priority: High first). */
  descFirst?: readonly string[];
  debounceMs?: number;
}

type Patch = Record<string, string | undefined>;

/**
 * List-page state kept in the URL: filters, search (debounced), sort, page, page size and `select`.
 * Any filter/sort change resets to page 1; changes push history entries (back button works) except search typing.
 */
export function useListParams({ filterKeys, defaultSort, descFirst = [], debounceMs = 300 }: ListParamsConfig) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spString = sp.toString();

  const get = (k: string) => sp.get(k) || undefined;
  const urlQ = get('q');

  const navigate = useCallback(
    (patch: Patch, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(spString);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, spString],
  );

  // Search box text is local so typing is instant; the URL (and query) follow after a pause.
  const [q, setQ] = useState(urlQ ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!timer.current) setQ(urlQ ?? '');
  }, [urlQ]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const filters: FilterValue = { q: q || undefined };
  for (const k of filterKeys) filters[k] = get(k);

  const onFiltersChange = (v: FilterValue) => {
    const nextQ = v.q ?? '';
    const patch: Patch = {};
    for (const k of filterKeys) if ((v[k] || undefined) !== get(k)) patch[k] = v[k] || undefined;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setQ(nextQ);
    if (nextQ !== (urlQ ?? '')) {
      if (Object.keys(patch).length === 0 && nextQ !== '') {
        // Typing: debounce, replace history.
        timer.current = setTimeout(() => {
          timer.current = null;
          navigate({ q: nextQ }, 'replace');
        }, debounceMs);
        return;
      }
      patch.q = nextQ || undefined; // Reset / cleared: apply immediately.
    }
    if (Object.keys(patch).length) navigate(patch);
  };

  const sort: SortState = {
    key: get('sort') ?? defaultSort.key,
    dir: (get('dir') as SortState['dir'] | undefined) ?? (get('sort') ? 'asc' : defaultSort.dir),
  };
  const onSort = (s: SortState) => {
    const dir = descFirst.includes(s.key) && sort.key !== s.key ? 'desc' : s.dir;
    navigate({ sort: s.key, dir });
  };

  const hrefFor = useCallback(
    (id: string) => {
      const next = new URLSearchParams(spString);
      next.set('select', id);
      return `${pathname}?${next.toString()}`;
    },
    [spString, pathname],
  );

  const select = useCallback(
    (id: string | null) => navigate({ select: id ?? undefined, page: new URLSearchParams(spString).get('page') ?? undefined }),
    [navigate, spString],
  );

  const page = Math.max(1, Number(get('page')) || 1);
  const pageSize = [10, 20, 50].includes(Number(get('pageSize'))) ? Number(get('pageSize')) : 10;

  return {
    params: Object.fromEntries(sp.entries()) as Record<string, string>,
    filters,
    onFiltersChange,
    sort,
    onSort,
    page,
    pageSize,
    onPageChange: (p: number) => navigate({ page: p <= 1 ? undefined : String(p) }),
    onPageSizeChange: (n: number) => navigate({ pageSize: n === 10 ? undefined : String(n) }),
    selectedId: get('select') ?? null,
    select,
    /** Applies several params at once (page resets unless given). */
    navigate,
    /** Query-string for a link that keeps the current filters and selects `id`. */
    hrefFor,
  };
}
