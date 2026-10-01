import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * §101-3 (1. okt 2026): paginated fetch for any Supabase table/view.
 *
 * Every read of a dataset without a known upper bound goes through this.
 * It paginates in chunks and returns truncated=true only if it could not
 * fetch everything (which should never happen — but if PostgREST or the
 * network cuts the response short, the caller must know).
 *
 * When truncated is true, the widget shows nothing — not a wrong number.
 */

const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGES = 50; // safety: 50k rows max

export interface PaginatedResult<T> {
  rows: T[];
  truncated: boolean;
}

export async function paginatedFetch<T>(opts: {
  table: string;
  select: string;
  filters?: (
    q: ReturnType<ReturnType<typeof getSupabaseClient>["from"]>["select"],
  ) => typeof q;
  pageSize?: number;
}): Promise<PaginatedResult<T>> {
  const supabase = getSupabaseClient();
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const all: T[] = [];
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabase
      .from(opts.table)
      .select(opts.select)
      .range(from, from + pageSize - 1);
    if (opts.filters) {
      q = opts.filters(q) as typeof q;
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // If we hit MAX_PAGES, something is wrong — mark as truncated
  const truncated = all.length >= MAX_PAGES * pageSize;

  return { rows: all, truncated };
}
