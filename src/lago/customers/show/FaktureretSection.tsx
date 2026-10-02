import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { paginatedFetch } from "@/lago/ui/paginatedFetch";
import { Button as LagoButton } from "@/lago/ui/Button";
import { Icon } from "@/lago/ui/Icon";
import { SectionHeader } from "@/lago/ui/SectionHeader";
import { Section } from "./LagoCustomerCard";

/**
 * §98-3b (2. okt 2026): Fakturerede ordrer på kundekortet.
 *
 * Data from sales_monthly_lago — fakturadato, produktnr, belob, antal.
 * Collapsed by default, newest first. 12 months by default; "Vis mere"
 * shows all history (not another 12 months).
 */

interface FaktureretLinje {
  fakturadato: string;
  produktnr: string;
  belob: number;
  antal: number;
  salgstype: string | null;
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function twelveMonthsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function FaktureretSection({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const query = useQuery({
    queryKey: ["lago-faktureret", vismaCustomerNo],
    queryFn: async () => {
      if (!vismaCustomerNo)
        return { rows: [] as FaktureretLinje[], truncated: false };
      return paginatedFetch<FaktureretLinje>({
        table: "sales_monthly_lago",
        select: "fakturadato, produktnr, belob, antal, salgstype",
        filters: (q) =>
          q
            .eq("visma_customer_no", vismaCustomerNo)
            .order("fakturadato", { ascending: false }),
      });
    },
    enabled: expanded && vismaCustomerNo != null,
    staleTime: 60_000,
  });

  const cutoff = twelveMonthsAgo();
  const allLines = query.data?.rows ?? [];
  const truncated = query.data?.truncated ?? false;
  const recentLines = useMemo(
    () => allLines.filter((l) => l.fakturadato >= cutoff),
    [allLines, cutoff],
  );
  const lines = showAll ? allLines : recentLines;
  const total = lines.reduce((s, l) => s + l.belob, 0);
  const hasOlder = allLines.length > recentLines.length;

  if (!vismaCustomerNo) return null;

  return (
    <Section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <SectionHeader
          title="Fakturerede ordrer"
          right={
            allLines.length > 0 ? (
              <span className="text-[length:var(--t-meta)] text-[var(--fg-2)]">
                {lines.length} linjer · {krFmt.format(total)} kr.
              </span>
            ) : null
          }
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
            <p className="py-2 text-sm text-[var(--fg-2)]">
              Ingen fakturerede linjer{showAll ? "" : " de seneste 12 måneder"}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
                    <th className="pb-2 pr-3 font-medium">Dato</th>
                    <th className="pb-2 pr-3 font-medium">Produkt</th>
                    <th className="pb-2 pr-3 text-right font-medium">Antal</th>
                    <th className="pb-2 text-right font-medium">Beløb</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr
                      key={`${l.fakturadato}-${l.produktnr}-${i}`}
                      className="border-t border-[var(--line)]"
                    >
                      <td className="py-1.5 pr-3 text-[var(--fg-2)]">
                        {dateFmt.format(new Date(l.fakturadato + "T12:00:00"))}
                      </td>
                      <td className="py-1.5 pr-3 text-[var(--fg)]">
                        {l.produktnr}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--fg)]">
                        {l.antal}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-[var(--fg)]">
                        {krFmt.format(l.belob)} kr.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
    </Section>
  );
}
