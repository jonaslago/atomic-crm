import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";

import { useActorSalesId } from "./useActorSalesId";

/**
 * Brief 84 tillæg A §1 (28. sep 2026) · listen af kolleger man kan passe for.
 *
 * "Alle må passe alle" — ingen rolle-check, ingen rettigheds-liste.
 * Excluderer den nuværende bruger (kan ikke passe sig selv) og
 * disabled/pending sales-rækker (som endnu ikke er reelle brugere).
 */

export interface CoveragePerson {
  salesId: number;
  userId: string;
  label: string;
  role: LagoRole;
}

export function useCoveragePeople(): {
  people: CoveragePerson[];
  isLoading: boolean;
} {
  const actorSalesId = useActorSalesId();
  const query = useQuery({
    queryKey: ["lago-coverage-people"],
    queryFn: async (): Promise<CoveragePerson[]> => {
      const { data, error } = await getSupabaseClient()
        .from("sales")
        .select("id, user_id, first_name, last_name, lago_role, disabled")
        .eq("disabled", false)
        .neq("first_name", "Pending");
      if (error) throw error;
      const rows =
        (data as Array<{
          id: number;
          user_id: string | null;
          first_name: string | null;
          last_name: string | null;
          lago_role: LagoRole | null;
          disabled: boolean;
        }>) ?? [];
      const mapped = rows
        .filter((r) => r.user_id != null)
        .map((r) => ({
          salesId: r.id,
          userId: r.user_id!,
          label:
            `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || `#${r.id}`,
          role: (r.lago_role ?? "saelger") as LagoRole,
        }));
      mapped.sort((a, b) => a.label.localeCompare(b.label, "da"));
      return mapped;
    },
    staleTime: 5 * 60 * 1000,
  });

  const people = (query.data ?? []).filter(
    (p) => p.salesId !== actorSalesId,
  );
  return { people, isLoading: query.isLoading };
}
