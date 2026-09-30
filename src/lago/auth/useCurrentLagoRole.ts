import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

export type LagoRole = "saelger" | "kontor" | "ledelse" | "admin";

const DEFAULT_ROLE: LagoRole = "saelger";

/**
 * Slår current user's LAGO-rolle op fra public.sales.lago_role.
 * Default 'saelger' hvis ingen bruger er logget ind eller kolonnen
 * er tom — så dashboard-grid'et altid kan rendere noget.
 *
 * Rollen bruges af DashboardGrid til at vælge widget-layout.
 * Rulle-felt til at ændre rollen ligger i SellersSection (kun admin).
 */
export function useCurrentLagoRole(): {
  role: LagoRole;
  isLoading: boolean;
  salesId: number | null;
} {
  const { data: identity, isLoading: identityLoading } = useGetIdentity();
  const salesId = typeof identity?.id === "number" ? identity.id : null;

  const roleQuery = useQuery({
    queryKey: ["lago-current-role", salesId],
    queryFn: async () => {
      if (salesId == null) return DEFAULT_ROLE;
      const { data, error } = await getSupabaseClient()
        .from("sales")
        .select("lago_role")
        .eq("id", salesId)
        .maybeSingle<{ lago_role: LagoRole | null }>();
      if (error) throw error;
      return (data?.lago_role ?? DEFAULT_ROLE) as LagoRole;
    },
    enabled: salesId != null,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: roleQuery.data ?? DEFAULT_ROLE,
    isLoading: identityLoading || roleQuery.isLoading,
    salesId,
  };
}
