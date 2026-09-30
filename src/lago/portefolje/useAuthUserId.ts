import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 84 §1 (28. sep 2026) · auth.uid() på klienten.
 *
 * useGetIdentity giver kun sales.id + fullName + avatar. auth.uid()
 * (uuid) skal bruges til coverage_log_lago.covering_user_id (RLS-
 * kravet er covering_user_id = auth.uid()). Samme mønster som
 * task_events_lago.event_af.
 */
export function useAuthUserId(): string | null {
  const query = useQuery({
    queryKey: ["lago-auth-user-id"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().auth.getUser();
      if (error) return null;
      return data.user?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return query.data ?? null;
}
