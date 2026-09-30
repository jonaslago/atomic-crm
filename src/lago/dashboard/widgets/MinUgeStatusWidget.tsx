// Brief 34 §1: sammenslåning af MinUge + MinStatus i ét visuelt panel
// ("Hvordan ligger jeg denne uge"). BEGGE dataopslag og BEGGE filer
// bevares — dette er et layout-skift, ikke et dataskift, så det kan
// rulles tilbage efter felttesten.
//
// Én sektion, to dele:
//   - Fire tal-rækker øverst (aktivitetsopgørelse) — --t-figure vægt 400
//   - Ugens planlagte-liste under (fra MinUge-data)

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { resolveVisitPriority } from "@/lago/customers/priority";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";

import { WidgetShell } from "../WidgetShell";

interface StatusData {
  besoegDenneUge: number;
  aktiviteterDenneUge: number;
  kunderNaaet: number;
  andelAjour: number | null;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // mandag som ugestart
  d.setDate(d.getDate() + diff);
  return d;
}

async function fetchStatus(salesId: number | null): Promise<StatusData> {
  const supabase = getSupabaseClient();
  const weekStart = startOfWeek();
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [besoegRes, aktRes, kunderRes] = await Promise.all([
    salesId != null
      ? supabase
          .from("customer_activities_lago")
          .select("id", { head: true, count: "exact" })
          .eq("activity_type", "Besøg")
          .eq("sales_id", salesId)
          .is("deleted_at", null)
          .gte("activity_date", weekStartIso)
      : Promise.resolve({ count: 0, error: null }),
    salesId != null
      ? supabase
          .from("customer_activities_lago")
          .select("id", { head: true, count: "exact" })
          .eq("sales_id", salesId)
          .is("deleted_at", null)
          .gte("activity_date", weekStartIso)
      : Promise.resolve({ count: 0, error: null }),
    salesId != null
      ? supabase
          .from("customer_activities_lago")
          .select("company_id")
          .eq("sales_id", salesId)
          .is("deleted_at", null)
          .gte("activity_date", weekStartIso)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ("error" in besoegRes && besoegRes.error) throw besoegRes.error;
  if ("error" in aktRes && aktRes.error) throw aktRes.error;
  if ("error" in kunderRes && kunderRes.error) throw kunderRes.error;

  const kunderNaaet = new Set(
    ((kunderRes.data ?? []) as Array<{ company_id: number }>).map(
      (r) => r.company_id,
    ),
  ).size;

  return {
    besoegDenneUge: besoegRes.count ?? 0,
    aktiviteterDenneUge: aktRes.count ?? 0,
    kunderNaaet,
    andelAjour: null, // beregnes client-side nedenfor via priority
  };
}

const nfmt = new Intl.NumberFormat("da-DK");
const pctFmt = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function MinUgeStatusWidget() {
  const mySalesId = useViewSalesId();

  const statusQuery = useQuery({
    queryKey: ["lago-min-uge-status", mySalesId],
    queryFn: () => fetchStatus(mySalesId),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const mineQuery = useQuery({
    queryKey: ["lago-min-uge-status-mine", mySalesId],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const andelAjour = useMemo(() => {
    const list = mineQuery.data ?? [];
    if (list.length === 0) return null;
    let onPlan = 0;
    let total = 0;
    for (const r of list) {
      const p = resolveVisitPriority(r.visit_priority);
      if (p.status === "no_urgency") continue;
      total++;
      if (p.status === "on_plan" || p.status === "soon") onPlan++;
    }
    return total > 0 ? onPlan / total : null;
  }, [mineQuery.data]);

  const isLoading = statusQuery.isPending || mineQuery.isPending;
  const error =
    (statusQuery.error as Error | null) ?? (mineQuery.error as Error | null);

  const s = statusQuery.data;
  const rows: Array<{ label: string; value: string; ajour?: boolean }> = s
    ? [
        { label: "Gennemførte besøg", value: nfmt.format(s.besoegDenneUge) },
        {
          label: "Registrerede aktiviteter",
          value: nfmt.format(s.aktiviteterDenneUge),
        },
        { label: "Kunder nået", value: nfmt.format(s.kunderNaaet) },
        {
          label: "Andel af porteføljen ajour",
          value: andelAjour == null ? "—" : pctFmt.format(andelAjour),
          ajour: andelAjour != null && andelAjour >= 0.75,
        },
      ]
    : [];

  return (
    <WidgetShell
      title="Dagens tal"
      subtitle="Ugens samlede aktivitetsopgørelse"
      isLoading={isLoading}
      error={error}
      isEmpty={mySalesId == null}
      emptyState="Log ind for at se din uge."
    >
      {/* Brief 85 token-runde (28. sep 2026): ydre wrapper er widgetens
          kort på siden (hvid), rækkerne er indstik (grå). Før var det
          modsat — samme inversion Panel/Inset havde. */}
      <div className="rounded-lg bg-[var(--surface)] p-3">
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex min-h-11 items-center justify-between rounded-md bg-[var(--surface-1)] px-3 py-2"
            >
              <span className="flex items-center gap-2 text-base font-normal text-[var(--fg-2)]">
                {r.label}
                {r.ajour && (
                  <span className="inline-flex items-center rounded-full bg-[var(--st-green-bg)] px-2 py-0.5 text-[13px] font-medium text-[var(--st-green-fg)]">
                    Ajour
                  </span>
                )}
              </span>
              <span className="tabular-nums text-2xl font-normal text-[var(--fg)]">
                {r.value}
              </span>
            </li>
          ))}
        </ul>
        {/* "Se alle" flyttet ned i sektionen fordi ugesammenfatningen
            har mere kontekst end en top-5-liste.
            Brief 87 tillæg (28. sep 2026): pegede før på kundelisten og
            på actor'ens portefølje — begge forkert. Aktivitetssiden har
            ugefilteret indbygget, og person=mySalesId (viewSalesId) sikrer
            det er kundens sælgers uge, ikke coverens. */}
        <div className="mt-3 text-right">
          <Link
            to={
              mySalesId != null
                ? `/aktiviteter?types=aftale&period=week&person=${mySalesId}`
                : `/aktiviteter?types=aftale&period=week`
            }
            className="text-[13px] font-medium text-[var(--fg-2)] no-underline hover:underline"
          >
            Se ugens planlagte besøg →
          </Link>
        </div>
      </div>
    </WidgetShell>
  );
}
