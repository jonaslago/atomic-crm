import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Slår current user's VISMA-sælgerkode op via sales_code_map_lago.
 *
 * Brief 71 §2 leverance A (21. sep 2026): kilde skiftet fra
 * lago_sellers.sales_id til sales_code_map_lago.crm_sales_id.
 * Tørkørsel viste 0 afvigelser mellem de to kolonner; efter dette
 * skift læses der ikke længere fra lago_sellers.sales_id noget sted,
 * og leverance B kan droppe kolonnen når verifikationen er kørt
 * torsdag med Simon.
 *
 * Returnerer null hvis:
 *   - ingen bruger logget ind
 *   - brugeren har ingen kobling i sales_code_map_lago (kun-læse-adgang;
 *     "mine kunder" giver 0 rækker — widget skal håndtere det ærligt)
 *   - brugeren er admin uden VISMA-kode (fx Jonas som PO)
 */
export function useCurrentSellerCode(): {
  visma_sales_code: string | null;
  isLoading: boolean;
  salesId: number | null;
} {
  const { data: identity, isLoading: identityLoading } = useGetIdentity();
  const salesId = typeof identity?.id === "number" ? identity.id : null;

  const codeQuery = useQuery({
    queryKey: ["lago-current-seller-code", salesId],
    queryFn: async () => {
      if (salesId == null) return null;
      const { data, error } = await getSupabaseClient()
        .from("sales_code_map_lago")
        .select("visma_sales_code")
        .eq("crm_sales_id", salesId)
        .maybeSingle<{ visma_sales_code: string | null }>();
      if (error) throw error;
      return data?.visma_sales_code ?? null;
    },
    enabled: salesId != null,
    staleTime: 5 * 60 * 1000,
  });

  return {
    visma_sales_code: codeQuery.data ?? null,
    isLoading: identityLoading || codeQuery.isLoading,
    salesId,
  };
}
