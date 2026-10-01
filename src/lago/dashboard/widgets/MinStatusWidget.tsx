import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useCurrentSellerCode } from "@/lago/auth/useCurrentSellerCode";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { resolveVisitPriority } from "@/lago/customers/priority";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";

import { WidgetShell } from "../WidgetShell";

/**
 * Min status denne uge (Domain-brief 18 §3.5).
 *
 * Aktivitets-halvdel: registrerede besøg denne uge, overskredne,
 * planlagte fremad.
 *
 * Salgs-halvdel: mit distrikts T12M og seneste 3 mdr. — SKJULES helt
 * når der ingen data er. Brief 20 pkt 11: v1.0 er et registrerings-
 * værktøj, salgsdata er v1.1. Sælgeren skal IKKE se en "importér
 * data"-invitation under felt-testen — det er ikke hans opgave.
 * Tallene dukker op af sig selv når v1.1's import kører.
 *
 * Tone: redskab, ikke overvågning. Ingen røde advarsler på personens
 * egen indsats — vækst-tal vises neutralt (positiv = grøn accent,
 * negativ = neutral, ikke rød).
 */

const kr = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 1,
});

// ---------- Aktivitet-halvdel ----------

interface AktivitetData {
  besoegDenneUge: number;
  overskredneCount: number;
  planlagteFrem: number;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Uge starter mandag (dansk konvention)
  const day = d.getDay(); // 0 = søn, 1 = man ...
  const diff = (day + 6) % 7; // dage siden mandag
  d.setDate(d.getDate() - diff);
  return d;
}

async function fetchAktivitet(input: {
  salesId: number | null;
}): Promise<AktivitetData> {
  const supabase = getSupabaseClient();

  // 1) Besøg denne uge — filter på sales_id (brief 20 pkt 12, 10. sep).
  //    Tekstmatch på sales_name er droppet: gav stille undertælling
  //    ved navneændringer, og det var netop det tal, felt-testen måler.
  const weekStart = startOfWeek();
  const besoegQuery =
    input.salesId != null
      ? supabase
          .from("customer_activities_lago")
          .select("id", { head: true, count: "exact" })
          .eq("activity_type", "Besøg")
          .eq("sales_id", input.salesId)
          // §24: only completed visits (done=true). A plan is not a visit.
          .eq("done", true)
          .is("deleted_at", null)
          .gte("activity_date", weekStart.toISOString().slice(0, 10))
      : Promise.resolve({ count: 0, error: null });

  // 2+3) Overskredne + planlagte — genbrug fetchCustomerList (onlyMine)
  const mine =
    input.salesId != null
      ? await fetchCustomerList({
          mySalesId: input.salesId,
          onlyMine: true,
        })
      : [];

  const now = new Date();
  const [besoegRes] = await Promise.all([besoegQuery]);
  if ("error" in besoegRes && besoegRes.error) throw besoegRes.error;

  return {
    besoegDenneUge: besoegRes.count ?? 0,
    overskredneCount: 0, // fyldes med priority-beregning nedenfor
    planlagteFrem: mine.filter(
      (c) =>
        c.extension?.next_visit_planned &&
        new Date(c.extension.next_visit_planned) >= now,
    ).length,
  };
}

// ---------- Salg-halvdel ----------

interface DistrictSalesRow {
  distrikt: string | null;
  kundetype: string | null;
  grouping_id: number;
  t12m: number;
  t12m_forrige: number;
  seneste_3m: number;
  seneste_3m_forrige: number;
}

async function fetchMitDistrikt(
  sellerCode: string | null,
): Promise<string | null> {
  if (!sellerCode) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies_lago")
    .select("distrikt")
    .eq("visma_sales_code", sellerCode)
    // Brief 26 §2 (rev. 16. sep 2026): to filtre nu — distrikt er
    // absolut (is_visible_to_sales), og inaktive kunder skal ikke
    // forurene sælgerens hoveddistrikt-gæt.
    .eq("is_visible_to_sales", true)
    .eq("is_active", true)
    .not("distrikt", "is", null);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { distrikt: string }[]) {
    counts.set(r.distrikt, (counts.get(r.distrikt) ?? 0) + 1);
  }
  let bestDistrikt: string | null = null;
  let bestCount = 0;
  for (const [d, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      bestDistrikt = d;
    }
  }
  return bestDistrikt;
}

async function fetchDistrictSales(
  distrikt: string,
): Promise<DistrictSalesRow | null> {
  const supabase = getSupabaseClient();
  // Distrikt-subtotal = grouping_id 1 (distrikt sat, kundetype null)
  const { data, error } = await supabase
    .from("v_sales_district_periods")
    .select(
      "distrikt, kundetype, grouping_id, t12m, t12m_forrige, seneste_3m, seneste_3m_forrige",
    )
    .eq("distrikt", distrikt)
    .eq("grouping_id", 1)
    .maybeSingle<DistrictSalesRow>();
  if (error) throw error;
  return data;
}

// ---------- Widget ----------

export function MinStatusWidget() {
  const salesId = useViewSalesId();
  const { visma_sales_code: sellerCode } = useCurrentSellerCode();

  const aktivitetQuery = useQuery({
    queryKey: ["lago-min-status-aktivitet", salesId],
    queryFn: () => fetchAktivitet({ salesId }),
    enabled: salesId != null,
    staleTime: 60_000,
  });

  const mitDistriktQuery = useQuery({
    queryKey: ["lago-mit-distrikt", sellerCode],
    queryFn: () => fetchMitDistrikt(sellerCode),
    enabled: sellerCode != null,
    staleTime: 10 * 60_000,
  });

  const salgQuery = useQuery({
    queryKey: ["lago-min-status-salg", mitDistriktQuery.data],
    queryFn: () => fetchDistrictSales(mitDistriktQuery.data!),
    enabled: !!mitDistriktQuery.data,
    staleTime: 5 * 60_000,
  });

  // Overskredne — genberegn client-side pga. priority-logikken (intervaller).
  const overskredneQuery = useQuery({
    queryKey: ["lago-min-status-overskredne", salesId],
    queryFn: async () => {
      if (salesId == null) return 0;
      const list = await fetchCustomerList({
        mySalesId: salesId,
        onlyMine: true,
      });
      return list.filter((c) => {
        const p = resolveVisitPriority(c.visit_priority);
        return p.status === "overdue" || p.status === "never_visited";
      }).length;
    },
    enabled: salesId != null,
    staleTime: 60_000,
  });

  // Brief 20 pkt 11: salgs-halvdel skjules når intet data. Ikke vist
  // som "importér data"-invitation — det er ikke sælgerens opgave.
  // "Har data" = querien er færdig og fandt en række.
  const salgHasData =
    !salgQuery.isPending && !salgQuery.isError && !!salgQuery.data;

  return (
    <WidgetShell
      title="Min status denne uge"
      isLoading={
        (aktivitetQuery.isPending || overskredneQuery.isPending) &&
        salesId != null
      }
      error={
        (aktivitetQuery.error as Error | null) ??
        (overskredneQuery.error as Error | null)
      }
    >
      <div
        className={
          "grid gap-4 " + (salgHasData ? "sm:grid-cols-2" : "sm:grid-cols-1")
        }
      >
        {/* Aktivitet-halvdel — vises altid */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--fg-2)]">
            Aktivitet
          </div>
          <div className="space-y-2">
            <Stat
              label="Registrerede besøg denne uge"
              value={String(aktivitetQuery.data?.besoegDenneUge ?? 0)}
            />
            <Stat
              label="Overskredne"
              value={String(overskredneQuery.data ?? 0)}
              tone={
                (overskredneQuery.data ?? 0) > 0 ? "neutral-strong" : "neutral"
              }
            />
            <Stat
              label="Planlagte fremad"
              value={String(aktivitetQuery.data?.planlagteFrem ?? 0)}
            />
          </div>
        </div>

        {/* Salgs-halvdel — kun når data findes (v1.1). Ingen tom-invite. */}
        {salgHasData && (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--fg-2)]">
                Salg
              </div>
              {mitDistriktQuery.data && (
                <div className="text-muted-foreground text-xs font-bold">
                  Distrikt: {mitDistriktQuery.data}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <SalgRow
                label="T12M"
                belob={Number(salgQuery.data!.t12m)}
                forrige={Number(salgQuery.data!.t12m_forrige)}
              />
              <SalgRow
                label="Seneste 3 mdr."
                belob={Number(salgQuery.data!.seneste_3m)}
                forrige={Number(salgQuery.data!.seneste_3m_forrige)}
              />
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

// ---------- Byggeklodser ----------

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "neutral-strong";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="text-sm text-[var(--fg-2)]">{label}</div>
      <div
        className={
          "text-base font-bold tabular-nums " +
          (tone === "neutral-strong" ? "text-[var(--fg)]" : "text-[var(--fg)]")
        }
      >
        {value}
      </div>
    </div>
  );
}

function SalgRow({
  label,
  belob,
  forrige,
}: {
  label: string;
  belob: number;
  forrige: number;
}) {
  const growthPct = forrige > 0 ? (belob - forrige) / forrige : null;
  const growthPositive = growthPct != null && growthPct > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm text-[var(--fg-2)]">{label}</div>
        <div className="text-base font-bold tabular-nums text-[var(--fg)]">
          {kr.format(belob)}
        </div>
      </div>
      {growthPct != null && (
        <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
          <div>vs. samme periode året før</div>
          <div
            className={
              "font-bold tabular-nums " +
              (growthPositive
                ? "text-[var(--st-green-fg)]"
                : "text-[var(--fg-2)]")
            }
          >
            {growthPositive ? "+" : ""}
            {pct.format(growthPct)}
          </div>
        </div>
      )}
    </div>
  );
}
