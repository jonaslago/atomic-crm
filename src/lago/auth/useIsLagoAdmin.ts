import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Upstream's `useGetIdentity()` only returns `{ id, fullName, avatar }`.
 * We need `administrator` for the LAGO Indstillinger surface, so we fetch
 * it directly from `public.sales` given the current identity id.
 *
 * Cached for the session (staleTime = 5 min) — the flag rarely changes
 * mid-session and if it does, a refresh gets the new state.
 */
export function useIsLagoAdmin(): {
  isAdmin: boolean;
  isLoading: boolean;
} {
  const { data: identity, isLoading: identityLoading } = useGetIdentity();
  const salesId = typeof identity?.id === "number" ? identity.id : null;

  const flagQuery = useQuery({
    queryKey: ["lago-admin-flag", salesId],
    queryFn: async () => {
      if (salesId == null) return false;
      const { data, error } = await getSupabaseClient()
        .from("sales")
        .select("administrator")
        .eq("id", salesId)
        .maybeSingle<{ administrator: boolean | null }>();
      if (error) throw error;
      return !!data?.administrator;
    },
    enabled: salesId != null,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAdmin: !!flagQuery.data,
    isLoading: identityLoading || flagQuery.isLoading,
  };
}
