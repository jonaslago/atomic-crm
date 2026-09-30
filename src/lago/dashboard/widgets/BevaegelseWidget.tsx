import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Kunder i bevægelse (brief 86 §5 · 28. sep 2026, rev. samme dag).
 *
 * Tre lister — fem i hver — ikke tre store tal. Rangering på kroner,
 * ikke procenter. En kunde der går fra 1.000 til 1.300 er "+30 %" og
 * betyder ingenting. En A-kunde der falder 180.000 er "−8 %" og betyder
 * alt.
 *
 *   Vokser              top 5 sorteret på aatd_vaekst_kr DESC (kun > 0)
 *   Falder              top 5 sorteret på aatd_vaekst_kr ASC  (kun < 0)
 *   Ingen køb i år      top 5 fra v_customer_activity_status.inaktiv=true,
 *                       sorteret på belob_i_vindue DESC (dem der har
 *                       mistet mest volumen inden for vinduet)
 *
 * Overskriften på hver liste viser antallet — men det er tallet i
 * listens univers ("kunder der er vokset"), ikke et tærskel-afhængigt
 * tal (43 vs 76 sagde ikke det samme uden ±20 %). Klik på en kunde →
 * kundekortet.
 *
 * "Ingen køb i år" er valgt frem for "Holdt op med at købe" fordi det
 * første er et faktum (t12m = 0), det andet en tolkning. Vi har ikke
 * en definition på hvornår en kunde er inaktiv — det er en åben
 * beslutning (LEAD-4…7's livscyklus-status). Kunder der allerede er
 * kendt ophørt (Tidl./Ophørt/Lukket i navnet) bliver stående øverst
 * på listen indtil livscyklus-status findes; det er et selvstændigt
 * hul, ikke noget at skjule i denne widget.
 *
 * Beløbet vises som "sidste 2 år: X kr." fordi belob_i_vindue er
 * summen over lago_settings.inactive_thresholds.vindue_aar (default 2).
 * Et tal uden en periode er ikke et tal.
 */

interface GrowthRow {
  visma_customer_no: string;
  company_id: number | null;
  kunde: string | null;
  aatd_vaekst_kr: string | number | null;
}

interface InactiveRow {
  visma_customer_no: string;
  company_id: number | null;
  kunde: string | null;
  belob_i_vindue: string | number | null;
}

interface Payload {
  vokser: GrowthRow[];
  falder: GrowthRow[];
  holdt_op: InactiveRow[];
  vokser_i_alt: number;
  falder_i_alt: number;
  holdt_op_i_alt: number;
}

async function fetchBevaegelse(): Promise<Payload> {
  const supabase = getSupabaseClient();

  const [
    vokserTop,
    falderTop,
    holdtOpTop,
    vokserCount,
    falderCount,
    holdtOpCount,
  ] = await Promise.all([
    supabase
      .from("v_sales_customer_periods")
      .select("visma_customer_no, company_id, kunde, aatd_vaekst_kr")
      .gt("aatd_vaekst_kr", 0)
      .order("aatd_vaekst_kr", { ascending: false })
      .limit(5),
    supabase
      .from("v_sales_customer_periods")
      .select("visma_customer_no, company_id, kunde, aatd_vaekst_kr")
      .lt("aatd_vaekst_kr", 0)
      .order("aatd_vaekst_kr", { ascending: true })
      .limit(5),
    supabase
      .from("v_customer_activity_status")
      .select("visma_customer_no, company_id, kunde, belob_i_vindue")
      .eq("inaktiv", true)
      .order("belob_i_vindue", { ascending: false })
      .limit(5),
    supabase
      .from("v_sales_customer_periods")
      .select("visma_customer_no", { count: "exact", head: true })
      .gt("aatd_vaekst_kr", 0),
    supabase
      .from("v_sales_customer_periods")
      .select("visma_customer_no", { count: "exact", head: true })
      .lt("aatd_vaekst_kr", 0),
    supabase
      .from("v_customer_activity_status")
      .select("visma_customer_no", { count: "exact", head: true })
      .eq("inaktiv", true),
  ]);

  if (vokserTop.error) throw vokserTop.error;
  if (falderTop.error) throw falderTop.error;
  if (holdtOpTop.error) throw holdtOpTop.error;
  if (vokserCount.error) throw vokserCount.error;
  if (falderCount.error) throw falderCount.error;
  if (holdtOpCount.error) throw holdtOpCount.error;

  return {
    vokser: (vokserTop.data ?? []) as GrowthRow[],
    falder: (falderTop.data ?? []) as GrowthRow[],
    holdt_op: (holdtOpTop.data ?? []) as InactiveRow[],
    vokser_i_alt: vokserCount.count ?? 0,
    falder_i_alt: falderCount.count ?? 0,
    holdt_op_i_alt: holdtOpCount.count ?? 0,
  };
}

const kroneFmt = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? Number(v) : v;
}

interface ColumnProps {
  title: string;
  total: number;
  emptyLabel: string;
  children: React.ReactNode;
}

function Column({ title, total, emptyLabel, children }: ColumnProps) {
  return (
    <div className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[13px] font-medium text-[var(--fg-2)]">{title}</div>
        <div className="text-xs text-[var(--fg-3)] tabular-nums">
          {total} i alt
        </div>
      </div>
      {total === 0 ? (
        <div className="text-sm text-[var(--fg-3)]">{emptyLabel}</div>
      ) : (
        <ul className="flex flex-col gap-1.5">{children}</ul>
      )}
    </div>
  );
}

function KundeRow({
  companyId,
  navn,
  vaerdi,
  tone,
  periodeLabel,
}: {
  companyId: number | null;
  navn: string | null;
  vaerdi: number;
  tone: "green" | "red" | "neutral";
  periodeLabel?: string;
}) {
  const label = navn ?? "Ukendt kunde";
  const toneCls =
    tone === "green"
      ? "text-[var(--st-green-fg)]"
      : tone === "red"
        ? "text-[var(--st-red-fg)]"
        : "text-[var(--fg-2)]";
  const beloeb = periodeLabel
    ? `${periodeLabel}: ${kroneFmt.format(vaerdi)}`
    : kroneFmt.format(vaerdi);
  const inner = (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="truncate text-[var(--fg)]">{label}</span>
      <span className={`shrink-0 tabular-nums ${toneCls}`}>{beloeb}</span>
    </div>
  );
  if (companyId == null) return <li>{inner}</li>;
  return (
    <li>
      <Link
        to={`/companies/${companyId}/show`}
        className="block no-underline hover:underline"
      >
        {inner}
      </Link>
    </li>
  );
}

export function BevaegelseWidget() {
  const query = useQuery({
    queryKey: ["lago-bevaegelse"],
    queryFn: fetchBevaegelse,
    staleTime: 60_000,
  });

  const data = query.data;
  const isEmpty =
    !!data &&
    data.vokser_i_alt === 0 &&
    data.falder_i_alt === 0 &&
    data.holdt_op_i_alt === 0;

  return (
    <WidgetShell
      title="Kunder i bevægelse"
      subtitle="År til dato mod sidste år · rangeret på kroner"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={isEmpty}
      emptyState="Ingen bevægelse måles endnu — venter på salgstal."
      seeAllHref="/salgsudvikling"
      seeAllLabel="Åbn Salgsudvikling"
    >
      {data && (
        <div className="flex flex-col gap-3 @[720px]:flex-row">
          <Column
            title="Vokser"
            total={data.vokser_i_alt}
            emptyLabel="Ingen kunder er vokset"
          >
            {data.vokser.map((r) => (
              <KundeRow
                key={r.visma_customer_no}
                companyId={r.company_id}
                navn={r.kunde}
                vaerdi={toNum(r.aatd_vaekst_kr)}
                tone="green"
                periodeLabel="ÅTD"
              />
            ))}
          </Column>
          <Column
            title="Falder"
            total={data.falder_i_alt}
            emptyLabel="Ingen kunder er faldet"
          >
            {data.falder.map((r) => (
              <KundeRow
                key={r.visma_customer_no}
                companyId={r.company_id}
                navn={r.kunde}
                vaerdi={toNum(r.aatd_vaekst_kr)}
                tone="red"
                periodeLabel="ÅTD"
              />
            ))}
          </Column>
          <Column
            title="Ingen køb i år"
            total={data.holdt_op_i_alt}
            emptyLabel="Ingen kunder uden køb i år"
          >
            {data.holdt_op.map((r) => (
              <KundeRow
                key={r.visma_customer_no}
                companyId={r.company_id}
                navn={r.kunde}
                vaerdi={toNum(r.belob_i_vindue)}
                tone="neutral"
                periodeLabel="sidste 2 år"
              />
            ))}
          </Column>
        </div>
      )}
    </WidgetShell>
  );
}
