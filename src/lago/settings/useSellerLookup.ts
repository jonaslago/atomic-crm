import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchLagoSellers } from "./dataAccess";

/**
 * One canonical `code → full_name` lookup, cached via react-query so
 * every LAGO-surface (kundekort, tidslinje, preview) resolver navnet det
 * samme sted (brief 11). Falls back to null when the code is unknown;
 * callers can then default to the legacy visma_sales_name column.
 */
export function useSellerLookup(): {
  byCode: (code: string | null | undefined) => string | null;
  /** Brief 48 §C (16. sep 2026): tasks har sales_id (peger på sales.id),
   *  ikke visma_sales_code. Opfølgnings-rækkerne på kundekortet skal
   *  vise "Ansvarlig: X" — vi resolver navnet gennem samme lookup
   *  frem for et ekstra query. */
  bySalesId: (id: number | null | undefined) => string | null;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ["lago-sellers"],
    queryFn: fetchLagoSellers,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const byCode = new Map<string, string>();
    const byId = new Map<number, string>();
    for (const s of query.data ?? []) {
      byCode.set(s.visma_sales_code, s.full_name);
      if (s.sales_id != null) byId.set(s.sales_id, s.full_name);
    }
    return {
      byCode: (code) => (code ? byCode.get(code) ?? null : null),
      bySalesId: (id) => (id != null ? byId.get(id) ?? null : null),
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading]);
}
