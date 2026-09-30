import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useTranslate } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";

/**
 * Amber testdata-bånd (Domain-brief 19b §0).
 *
 * Vises fuld bredde øverst i appen — også mobil — så længe der findes
 * salgs-rækker med er_testdata = true i sales_monthly_lago eller
 * open_orders_lago. Forsvinder automatisk når admin har ryddet alle
 * testdata og importeret driftsdata.
 *
 * "Et forældet tal er en detalje; et ikke-gyldigt tal er noget andet.
 * Ledelsen må aldrig kunne læse et testtal som virkeligt."
 * (Projektprincip 4: demo-mock skal mærkes som demo-mock.)
 *
 * Bevidst undtagelse fra reglen om at synk-status kun står ét diskret
 * sted (den lever i topbjælken via SalgsdataSyncStatus).
 */

async function fetchHasTestdata(): Promise<boolean> {
  const supabase = getSupabaseClient();
  // To parallelle limit-1-queries er billigere end en union-view fordi
  // supabase-js-klienten ikke understøtter arbitrary SQL. Første "true"
  // vinder — vi returnerer så snart vi finder én række med er_testdata.
  const [sm, oo] = await Promise.all([
    supabase
      .from("sales_monthly_lago")
      .select("visma_customer_no", { head: true, count: "exact" })
      .eq("er_testdata", true)
      .limit(1),
    supabase
      .from("open_orders_lago")
      .select("ordre_nr", { head: true, count: "exact" })
      .eq("er_testdata", true)
      .limit(1),
  ]);
  if (sm.error) throw sm.error;
  if (oo.error) throw oo.error;
  return (sm.count ?? 0) > 0 || (oo.count ?? 0) > 0;
}

export function TestdataBanner() {
  const translate = useTranslate();
  const query = useQuery({
    queryKey: ["lago-has-testdata"],
    queryFn: fetchHasTestdata,
    // Ingen polling — værdien ændrer sig når admin importerer eller
    // rydder. Mount + window focus (react-query default) er nok.
    staleTime: 5 * 60_000,
  });

  // Under første load: vis intet (undgår flimmer)
  // Ved fejl: vis heller ikke (fail-open — bandet er en advarsel,
  // og en fejl-tilstand skal ikke selv trigge en falsk advarsel)
  if (query.isPending || query.isError || query.data !== true) return null;

  return (
    <div
      role="status"
      className="w-full bg-[var(--st-amber-bg)] text-[var(--st-amber-fg)] border-b border-[var(--st-amber-fg)]/20"
    >
      <div className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 py-2 text-sm font-bold">
        <Icon icon={AlertTriangle} size="sm" />
        <span>
          {translate("lago.testdata.banner", {
            _: "Testdata — salgstallene er ikke gyldige og må ikke bruges til beslutninger.",
          })}
        </span>
      </div>
    </div>
  );
}
