import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { Meta } from "@/lago/ui/Meta";
import { SectionHeader } from "@/lago/ui/SectionHeader";
import { Section, type SectionLayout } from "./LagoCustomerCard";

/**
 * §98-3a (2. okt 2026): log at the bottom of the customer card.
 *
 * Everything that happened around this customer — not the visits (those
 * are in the activity timeline), but everything else:
 * - Closed tasks
 * - Change suggestions (accepted/rejected)
 * - Order comments with office response
 * - Deletions (sletninger_lago)
 *
 * Reverse chronological, collapsed by default. Each line: what · who · when.
 * No actions — this is a log, not a work list.
 */

interface LogEntry {
  key: string;
  date: string;
  what: string;
  who: string | null;
  detail: string | null;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

async function fetchCustomerLog(companyId: number): Promise<LogEntry[]> {
  const supabase = getSupabaseClient();
  const entries: LogEntry[] = [];

  // 1. Closed tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, text, done_date, completed_by_sales_id, sales:completed_by_sales_id(first_name, last_name), contacts!inner(company_id)",
    )
    .not("done_date", "is", null)
    .eq("contacts.company_id", companyId)
    .order("done_date", { ascending: false })
    .limit(50);
  for (const t of (tasks ?? []) as Array<{
    id: number;
    text: string | null;
    done_date: string;
    sales: { first_name: string | null; last_name: string | null } | null;
  }>) {
    const who = t.sales
      ? [t.sales.first_name, t.sales.last_name].filter(Boolean).join(" ")
      : null;
    entries.push({
      key: `task-${t.id}`,
      date: t.done_date,
      what: `Opgave klaret: ${t.text ?? "(uden tekst)"}`,
      who,
      detail: null,
    });
  }

  // 2. Change suggestions (not afventer)
  const { data: suggestions } = await supabase
    .from("kunde_aendringsforslag_lago")
    .select(
      "id, felt, foreslaaet_vaerdi, status, lukket, lukket_grund, sales_proposer:foreslaaet_af(first_name, last_name), sales_closer:lukket_af(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .neq("status", "afventer")
    .order("lukket", { ascending: false })
    .limit(50);
  for (const s of (suggestions ?? []) as Array<{
    id: number;
    felt: string;
    foreslaaet_vaerdi: string;
    status: string;
    lukket: string | null;
    lukket_grund: string | null;
    sales_proposer: {
      first_name: string | null;
      last_name: string | null;
    } | null;
    sales_closer: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  }>) {
    const closer = s.sales_closer
      ? [s.sales_closer.first_name, s.sales_closer.last_name]
          .filter(Boolean)
          .join(" ")
      : null;
    const statusLabel =
      s.status === "gennemfoert"
        ? "Gennemført"
        : s.status === "afvist"
          ? "Afvist"
          : "Bortfaldet";
    entries.push({
      key: `suggestion-${s.id}`,
      date: s.lukket ?? "",
      what: `Ændringsforslag ${statusLabel.toLowerCase()}: ${s.felt} → ${s.foreslaaet_vaerdi}`,
      who: closer,
      detail: s.lukket_grund,
    });
  }

  // 3. Order comments (closed)
  const { data: comments } = await supabase
    .from("ordre_kommentar_lago")
    .select(
      "id, ordre_nr, hensigt, status, lukket, lukket_grund, note, sales:oprettet_af(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .neq("status", "afventer")
    .order("lukket", { ascending: false })
    .limit(50);
  for (const c of (comments ?? []) as Array<{
    id: number;
    ordre_nr: string;
    hensigt: string;
    status: string;
    lukket: string | null;
    lukket_grund: string | null;
    note: string | null;
    sales: { first_name: string | null; last_name: string | null } | null;
  }>) {
    const who = c.sales
      ? [c.sales.first_name, c.sales.last_name].filter(Boolean).join(" ")
      : null;
    const statusLabel = c.status === "udfoert" ? "Udført" : "Afvist";
    entries.push({
      key: `comment-${c.id}`,
      date: c.lukket ?? "",
      what: `Ordrekommentar ${statusLabel.toLowerCase()} — ordre #${c.ordre_nr}`,
      who,
      detail: c.lukket_grund,
    });
  }

  // 4. Deletions
  const { data: deletions } = await supabase
    .from("sletninger_lago")
    .select(
      "id, objekt_type, slettet, begrundelse, slettet_af, sales:slettet_af(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .is("genskabt", null)
    .order("slettet", { ascending: false })
    .limit(50);
  for (const d of (deletions ?? []) as Array<{
    id: number;
    objekt_type: string;
    slettet: string;
    begrundelse: string | null;
    sales: { first_name: string | null; last_name: string | null } | null;
  }>) {
    const who = d.sales
      ? [d.sales.first_name, d.sales.last_name].filter(Boolean).join(" ")
      : null;
    entries.push({
      key: `deletion-${d.id}`,
      date: d.slettet,
      what: `${d.objekt_type.charAt(0).toUpperCase() + d.objekt_type.slice(1)} slettet`,
      who,
      detail: d.begrundelse,
    });
  }

  // Sort reverse chronological
  entries.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return entries;
}

export function CustomerLogSection({
  companyId,
  layout = "mobile",
}: {
  companyId: number;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const [expanded, setExpanded] = useState(false);

  const query = useQuery({
    queryKey: ["lago-customer-log", companyId],
    queryFn: () => fetchCustomerLog(companyId),
    enabled: expanded,
    staleTime: 60_000,
  });

  const entries = query.data ?? [];

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
            title="Log"
            subtitle={
              entries.length > 0 ? `${entries.length} hændelser` : undefined
            }
          />
        ) : (
          <SectionHeader
            title="Log"
            right={
              entries.length > 0 ? (
                <Meta>{entries.length} hændelser</Meta>
              ) : null
            }
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
          {query.isPending ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--fg-2)]">
              <Icon icon={Loader2} className="animate-spin" /> Henter…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-2 text-sm text-[var(--fg-2)]">
              Ingen log-hændelser endnu.
            </p>
          ) : (
            <ul className="flex flex-col">
              {entries.map((e) => (
                <li
                  key={e.key}
                  className="flex flex-col gap-0.5 border-t border-[var(--line)] py-2"
                >
                  <p className="text-sm text-[var(--fg)]">{e.what}</p>
                  {e.detail && (
                    <p className="text-[13px] text-[var(--fg-2)]">{e.detail}</p>
                  )}
                  <p className="text-[12px] text-[var(--fg-3)]">
                    {e.who ?? "(ukendt)"} · {fmtDate(e.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}
