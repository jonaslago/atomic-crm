import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Ledelsens tal (Domain-brief efter brief 42 · 16. sep 2026).
 *
 * Fire tal pr. sælger: registrerede besøg i dag, denne uge, planlagte
 * denne uge, planlagte senere. Samme kilder som MinStatusWidget bruger
 * for én sælger — her uden sælger-filter, grupperet.
 *
 * Formålet er Jonas' eget og står i widgetten: "så jeg kan puffe jer
 * kærligt i ryggen". Ingen rangering — alfabetisk sortering. Ingen
 * farvekodning af hvem der er bagest. Tallene er individuelle, ikke
 * en tavle. Tal-cellerne står i tabular-nums så kolonner flugter.
 *
 * Ole logger ind på en tom skærm hvis dette widget ikke findes —
 * ROLE_LAYOUTS.ledelse er [] uden det. Blank side er værst.
 */

interface SellerRow {
  sales_id: number;
  full_name: string;
  besoeg_i_dag: number;
  besoeg_denne_uge: number;
  planlagt_denne_uge: number;
  planlagt_senere: number;
}

function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Uge starter mandag (dansk konvention). day 0 = søn, 1 = man, …
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff + 6); // søndag
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchLedelsensTal(): Promise<SellerRow[]> {
  const supabase = getSupabaseClient();
  const today = todayIso();
  const weekStart = startOfWeekIso();
  const weekEnd = endOfWeekIso();

  // Brief 71 §2 leverance A (21. sep 2026): sælger→CRM-bruger-kobling
  // læses fra sales_code_map_lago.crm_sales_id, ikke lago_sellers.sales_id.
  // Vi joiner over visma_sales_code — lago_sellers har navn+aktiv-flag,
  // sales_code_map_lago har den kanoniske CRM-kobling.
  const [sellersRes, mapRes] = await Promise.all([
    supabase
      .from("lago_sellers")
      .select("visma_sales_code, full_name, active")
      .eq("active", true),
    supabase
      .from("sales_code_map_lago")
      .select("visma_sales_code, crm_sales_id")
      .not("crm_sales_id", "is", null),
  ]);
  if (sellersRes.error) throw sellersRes.error;
  if (mapRes.error) throw mapRes.error;

  const salesIdByCode = new Map<string, number>();
  for (const m of (mapRes.data ?? []) as Array<{
    visma_sales_code: string;
    crm_sales_id: number;
  }>) {
    salesIdByCode.set(m.visma_sales_code, m.crm_sales_id);
  }

  const sellers: Array<{ sales_id: number; full_name: string }> = [];
  for (const row of (sellersRes.data ?? []) as Array<{
    visma_sales_code: string;
    full_name: string;
  }>) {
    const salesId = salesIdByCode.get(row.visma_sales_code);
    if (salesId != null)
      sellers.push({ sales_id: salesId, full_name: row.full_name });
  }
  sellers.sort((a, b) => a.full_name.localeCompare(b.full_name, "da"));
  if (sellers.length === 0) return [];

  const salesIds = sellers.map((s) => s.sales_id);

  // Alle relevante customer_activities_lago-rækker i ét kald — grupper
  // client-side. Det er billigt (nogle hundrede rækker i alt) og undgår
  // fem tur/retur pr. sælger.
  const activitiesRes = await supabase
    .from("customer_activities_lago")
    .select("sales_id, activity_type_code, activity_date, done")
    .in("sales_id", salesIds)
    .is("deleted_at", null)
    .gte("activity_date", weekStart);
  if (activitiesRes.error) throw activitiesRes.error;

  // Brief 72 tillæg A §3 (21. sep 2026): midlertidigt filtrerer vi på
  // kundens ansvarlige sælger (companies.sales_id) i stedet for
  // next_visit_planned_by. Grunden: "hvem kører derud" findes ikke som
  // felt endnu — vi har kun "hvem ejer kunden" og "hvem bookede besøget",
  // og next_visit_planned_by mangler historisk på 2 af 3 planlagte
  // besøg (ikke-UI-kilder + rækker fra før PlanVisitDialog eksisterede).
  // companies.sales_id er altid sat og er sandt i dag, hvor ingen
  // planlægger på andres vegne. Det holder ikke, den dag Rikke
  // planlægger et besøg, hun selv skal køre. Afventer beslutning om
  // besøgets formål og modtager — se ROADMAP.
  // next_visit_planned_by skrives fortsat af PlanVisitDialog som
  // provenienssspor (§1).
  const plannedVisitsRes = await supabase
    .from("companies_lago")
    .select("next_visit_planned, company_id, companies!inner(sales_id)")
    .gte("next_visit_planned", `${today}T00:00:00`);
  if (plannedVisitsRes.error) throw plannedVisitsRes.error;

  // Byg per-sælger-tællinger.
  const perSeller = new Map<number, SellerRow>();
  for (const s of sellers) {
    perSeller.set(s.sales_id, {
      sales_id: s.sales_id,
      full_name: s.full_name,
      besoeg_i_dag: 0,
      besoeg_denne_uge: 0,
      planlagt_denne_uge: 0,
      planlagt_senere: 0,
    });
  }

  for (const a of (activitiesRes.data ?? []) as Array<{
    sales_id: number;
    activity_type_code: number | null;
    activity_date: string;
    done: boolean;
  }>) {
    const row = perSeller.get(a.sales_id);
    if (!row) continue;
    const isBesoeg = a.activity_type_code === 1;
    const inThisWeek =
      a.activity_date >= weekStart && a.activity_date <= weekEnd;
    const isFuture = a.activity_date > today;
    if (a.done && isBesoeg) {
      if (a.activity_date === today) row.besoeg_i_dag++;
      if (inThisWeek) row.besoeg_denne_uge++;
    }
    if (!a.done) {
      if (inThisWeek && a.activity_date >= today) row.planlagt_denne_uge++;
      else if (isFuture) row.planlagt_senere++;
    }
  }

  // Brief 72 tillæg A §3: filtrer på kundens ansvarlige sælger fra
  // embedded companies-række. PostgREST returnerer companies som objekt
  // (fordi FK'en er 1-1); kan være null hvis join fejler.
  for (const v of (plannedVisitsRes.data ?? []) as Array<{
    next_visit_planned: string;
    company_id: number;
    companies: { sales_id: number | null } | null;
  }>) {
    const responsibleSalesId = v.companies?.sales_id ?? null;
    if (responsibleSalesId == null) continue;
    const row = perSeller.get(responsibleSalesId);
    if (!row) continue;
    // next_visit_planned er en timestamp; ekstraktion af date-del til
    // sammenligning med week-boundaries som strenge.
    const dateStr = v.next_visit_planned.slice(0, 10);
    if (dateStr >= weekStart && dateStr <= weekEnd && dateStr >= today) {
      row.planlagt_denne_uge++;
    } else if (dateStr > weekEnd) {
      row.planlagt_senere++;
    }
  }

  return Array.from(perSeller.values());
}

export function LedelsensTalWidget() {
  const query = useQuery({
    queryKey: ["lago-ledelsens-tal"],
    queryFn: fetchLedelsensTal,
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  // Brief 72 tillæg A §2 (21. sep 2026): lutter nuller må ikke se ud
  // som et måleresultat. Er hver eneste celle 0, står en sætning over
  // tabellen der siger hvad de betyder — sælgernavnene bliver stående
  // så man kan se hvem der er med.
  const allZero =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.besoeg_i_dag === 0 &&
        r.besoeg_denne_uge === 0 &&
        r.planlagt_denne_uge === 0 &&
        r.planlagt_senere === 0,
    );

  return (
    <WidgetShell
      title="Sælgernes uge"
      subtitle="Så jeg kan puffe jer kærligt i ryggen — ikke en rangering"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen sælgere med login endnu — invitationerne skal først sendes."
    >
      {allZero && (
        <p className="mb-3 text-[var(--fg-2)] text-sm">
          Ingen planlagte besøg i hele virksomheden.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
              <th className="pb-2 pr-3 font-medium">Sælger</th>
              <th className="pb-2 pr-3 text-right font-medium">I dag</th>
              <th className="pb-2 pr-3 text-right font-medium">Denne uge</th>
              <th className="pb-2 pr-3 text-right font-medium">
                Planlagt denne uge
              </th>
              <th className="pb-2 text-right font-medium">Planlagt senere</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sales_id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">{r.full_name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.besoeg_i_dag}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.besoeg_denne_uge}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.planlagt_denne_uge}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                  {r.planlagt_senere}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
