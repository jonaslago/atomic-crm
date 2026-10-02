import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { paginatedFetch } from "@/lago/ui/paginatedFetch";
import { Button as LagoButton } from "@/lago/ui/Button";
import { Icon } from "@/lago/ui/Icon";
import { Meta } from "@/lago/ui/Meta";
import { SectionHeader } from "@/lago/ui/SectionHeader";
import { Section, type SectionLayout } from "./LagoCustomerCard";

/**
 * §98-3b (2. okt 2026): Fakturerede ordrer på kundekortet.
 *
 * Same design as AabneOrdrerSection: SectionHeader, Panel, same column
 * widths and text styling. Product names from products_lago (same lookup
 * as useOpenOrders). Collapsed by default, 12 months, "Vis al historik".
 */

interface RawLine {
  fakturadato: string;
  produktnr: string;
  belob: number;
  antal: number;
  salgstype: string | null;
}

interface DisplayLine extends RawLine {
  produktnavn: string;
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
});

function twelveMonthsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function fetchFaktureret(
  vismaCustomerNo: string,
): Promise<{ lines: DisplayLine[]; truncated: boolean }> {
  const supabase = getSupabaseClient();

  const result = await paginatedFetch<RawLine>({
    table: "sales_monthly_lago",
    select: "fakturadato, produktnr, belob, antal, salgstype",
    filters: (q) =>
      q
        .eq("visma_customer_no", vismaCustomerNo)
        .order("fakturadato", { ascending: false }),
  });

  // Product name lookup — same pattern as useOpenOrders
  const allNr = new Set(result.rows.map((r) => r.produktnr).filter(Boolean));
  const navnByNr = new Map<string, string>();
  if (allNr.size > 0) {
    // Chunk to avoid URL-length limit
    const chunks = [...allNr];
    const CHUNK = 200;
    for (let i = 0; i < chunks.length; i += CHUNK) {
      const batch = chunks.slice(i, i + CHUNK);
      const { data } = await supabase
        .from("products_lago")
        .select("produktnr, beskrivelse")
        .in("produktnr", batch);
      for (const p of (data ?? []) as Array<{
        produktnr: string;
        beskrivelse: string | null;
      }>) {
        if (p.beskrivelse) navnByNr.set(p.produktnr, p.beskrivelse);
      }
    }
  }

  const lines: DisplayLine[] = result.rows.map((r) => ({
    ...r,
    produktnavn: navnByNr.get(r.produktnr) ?? r.produktnr,
  }));

  return { lines, truncated: result.truncated };
}

export function FaktureretSection({
  vismaCustomerNo,
  layout = "mobile",
}: {
  vismaCustomerNo: string | null;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const query = useQuery({
    queryKey: ["lago-faktureret", vismaCustomerNo],
    queryFn: () => fetchFaktureret(vismaCustomerNo!),
    enabled: expanded && vismaCustomerNo != null,
    staleTime: 60_000,
  });

  const cutoff = twelveMonthsAgo();
  const allLines = useMemo(() => query.data?.lines ?? [], [query.data]);
  const truncated = query.data?.truncated ?? false;
  const recentLines = useMemo(
    () => allLines.filter((l) => l.fakturadato >= cutoff),
    [allLines, cutoff],
  );
  const lines = showAll ? allLines : recentLines;
  const total = lines.reduce((s, l) => s + l.belob, 0);
  const hasOlder = allLines.length > recentLines.length;

  if (!vismaCustomerNo) return null;

  const countLabel =
    allLines.length > 0
      ? `${lines.length} linjer · ${krFmt.format(total)} kr.`
      : null;

  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        {isLaptop ? (
          <SectionHeader
            variant="label"
            title="Fakturerede ordrer"
            subtitle={countLabel ?? undefined}
          />
        ) : (
          <SectionHeader
            title="Fakturerede ordrer"
            right={countLabel ? <Meta>{countLabel}</Meta> : null}
          />
        )}
        <Icon
          icon={expanded ? ChevronDown : ChevronRight}
          size="sm"
          className="shrink-0 text-[var(--fg-3)]"
        />
      </button>
      {expanded && (
        <>
          {truncated ? (
            <p className="py-2 text-sm text-[var(--st-amber-fg)]">
              Datasættet er afkortet ({allLines.length} rækker hentet). Tallet
              vises ikke.
            </p>
          ) : query.isPending ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--fg-2)]">
              <Icon icon={Loader2} className="animate-spin" /> Henter…
            </div>
          ) : lines.length === 0 ? (
            <div className="py-2">
              <p className="text-sm text-[var(--fg-2)]">
                Ingen fakturerede linjer
                {showAll ? "" : " de seneste 12 måneder"}.
              </p>
              {hasOlder && !showAll && (
                <LagoButton
                  variant="secondary"
                  className="mt-2"
                  onClick={() => setShowAll(true)}
                >
                  Vis al historik ({allLines.length} linjer)
                </LagoButton>
              )}
            </div>
          ) : (
            <>
              <ul className="flex flex-col">
                {lines.map((l, i) => (
                  <li
                    key={`${l.fakturadato}-${l.produktnr}-${i}`}
                    className="flex items-baseline gap-3 border-t border-[var(--line)] py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
                      {l.produktnavn}
                      {l.produktnavn !== l.produktnr && (
                        <span className="ml-1 text-[var(--fg-3)]">
                          {l.produktnr}
                        </span>
                      )}
                      {l.salgstype && l.salgstype !== "" && (
                        <span className="ml-1 text-[length:var(--t-meta)] text-[var(--fg-3)]">
                          · {l.salgstype}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[length:var(--t-meta)] tabular-nums text-[var(--fg-2)]">
                      {l.antal} stk.
                    </span>
                    <span className="shrink-0 text-sm tabular-nums font-medium text-[var(--fg)]">
                      {l.belob === 0 && l.antal > 0
                        ? "0 kr."
                        : `${krFmt.format(l.belob)} kr.`}
                    </span>
                    <span className="shrink-0 text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      {dateFmt.format(new Date(l.fakturadato + "T12:00:00"))}
                    </span>
                  </li>
                ))}
              </ul>
              {hasOlder && !showAll && (
                <LagoButton
                  variant="secondary"
                  className="mt-2 w-full justify-center"
                  onClick={() => setShowAll(true)}
                >
                  Vis al historik ({allLines.length} linjer)
                </LagoButton>
              )}
              {showAll && hasOlder && (
                <LagoButton
                  variant="secondary"
                  className="mt-2 w-full justify-center"
                  onClick={() => setShowAll(false)}
                >
                  Vis kun seneste 12 måneder
                </LagoButton>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
}
