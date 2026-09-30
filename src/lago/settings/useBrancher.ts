import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchBrancher, type Branche } from "./brancherDataAccess";

/**
 * Brief 53 §3 (17. sep 2026) · canonical opslag for brancher.
 *
 * En cache pr. session — brancher ændrer sig sjældent. `byKode` giver
 * navnet ud fra koden (fx til Stamdata på kundekortet), `activeOptions`
 * er dropdown-listen (kun aktive, sorteret).
 */
export function useBrancher(): {
  all: Branche[];
  activeOptions: Branche[];
  byKode: (kode: number | null | undefined) => Branche | null;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ["lago-brancher"],
    queryFn: fetchBrancher,
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    const all = query.data ?? [];
    const map = new Map<number, Branche>();
    for (const b of all) map.set(b.kode, b);
    return {
      all,
      activeOptions: all.filter((b) => b.aktiv),
      byKode: (k) => (k != null ? map.get(k) ?? null : null),
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading]);
}
