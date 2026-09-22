import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { humanOverdue } from "@/lago/ui/humanDuration";
import { shortenSalesName } from "@/lago/ui/shortenSalesName";
import { StatusPill } from "@/lago/ui/StatusPill";
import { RegistrerModal } from "@/lago/registrer/RegistrerModal";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";

/**
 * Ringeliste — udestående overskridelser (Domain-brief 18 §4.1,
 * rev. brief 34 §5).
 *
 * Overskredne kunder UDEN plan, ældst overskridelse først. Modellen:
 * kunden er sælgerens indtil dag 5 efter overskridelsen, herefter
 * dukker den op her som kontorets fallback.
 *
 * Responsive (brief 34 §5): TABEL på ≥1280 px, panel-rækker under.
 * Rækkens indhold er det samme — kun opstillingen skifter. Ingen
 * vandret scroll, nogensinde.
 */

const CLIP_TO = 5;
const RPC_LIMIT = 20;

interface RingelistenRow {
  id: number;
  name: string;
  city: string | null;
  sales_id: number | null;
  segment: string | null;
  distrikt: string | null;
  last_visit_at: string | null;
  visma_sales_name: string | null;
  days_overdue: number;
  interval_days: number;
  /** Brief 65 (18. sep 2026): "vil helst bare ringes op" — vises dæmpet
   *  under kundenavnet så kontoret ved det inden opkaldet. */
  besoegsfrekvens_note: string | null;
}

interface EnrichedRow {
  id: number;
  name: string;
  city: string | null;
  segment: string | null;
  distrikt: string | null;
  last_visit_at: string | null;
  visma_sales_name: string | null;
  daysOverdue: number;
  besoegsfrekvens_note: string | null;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

async function fetchRingeliste(): Promise<{
  rows: RingelistenRow[];
  total: number;
}> {
  const supabase = getSupabaseClient();
  // Brief 57 (17. sep 2026): server-side RPC. Erstatter fetchCustomerList({})
  // — som hentede op til 5000 kunder + hele companies_lago-embed'en for at
  // køre overdue-beregningen client-side. Nu returnerer basen kun de op
  // til 20 kandidater der matcher: status='overdue' AND next_visit_planned
  // IS NULL AND daysOverdue >= 5. iPhone-netværk kunne ikke tåle 5000-
  // række-payload'en; desktop kunne.
  const { data, error } = await supabase.rpc("dashboard_ringeliste_lago", {
    p_limit: RPC_LIMIT,
  });
  if (error) throw error;
  const payload = data as {
    rows: RingelistenRow[] | null;
    total: number;
  } | null;
  return {
    rows: payload?.rows ?? [],
    total: payload?.total ?? 0,
  };
}

export function RingelistenWidget() {
  const query = useQuery({
    queryKey: ["lago-ringeliste"],
    queryFn: fetchRingeliste,
    staleTime: 60_000,
  });

  // RPC'en sorterer allerede (segment-rank → daysOverdue DESC → navn),
  // så vi mapper 1:1 og lader UI-laget alene om at klippe til CLIP_TO.
  const rowsAll = useMemo<EnrichedRow[]>(() => {
    if (!query.data) return [];
    return query.data.rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      segment: r.segment,
      distrikt: r.distrikt,
      last_visit_at: r.last_visit_at,
      visma_sales_name: r.visma_sales_name,
      daysOverdue: r.days_overdue,
      besoegsfrekvens_note: r.besoegsfrekvens_note ?? null,
    }));
  }, [query.data]);

  const totalCount = query.data?.total ?? 0;
  const clipped = rowsAll.slice(0, CLIP_TO);
  const hasMore = totalCount > clipped.length;

  return (
    <WidgetShell
      title="Ringeliste — udestående overskridelser"
      subtitle="Kunder over frist uden kontakt fra sælger inden for fem hverdage"
      isLoading={query.isPending}
      error={query.error as Error | null}
      errorMessage="Kunne ikke hente ringelisten. Prøv at genindlæse."
      isEmpty={totalCount === 0}
      count={
        totalCount > 0
          ? {
              label: `${totalCount} udestående`,
              tone: "red",
            }
          : { label: "Ingen udestående", tone: "neutral" }
      }
      emptyState="Ingen overskredne uden plan (5+ dage over) lige nu — sælgerne holder trit."
    >
      {/* PC (≥1280 px): tabel med syv kolonner. */}
      <div className="hidden @[1280px]:block">
        <div className="rounded-lg bg-[var(--surface-1)] p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] font-medium uppercase tracking-wide text-[var(--fg-2)]">
                <th className="px-3 pb-3 pt-2">Kunde</th>
                <th className="px-3 pb-3 pt-2">Seg.</th>
                <th className="px-3 pb-3 pt-2">Distrikt</th>
                <th className="px-3 pb-3 pt-2 text-right tabular-nums">
                  Dage over
                </th>
                <th className="px-3 pb-3 pt-2">Sidste kontakt</th>
                <th className="px-3 pb-3 pt-2">Sælger</th>
                <th className="px-3 pb-3 pt-2 text-right">Handling</th>
              </tr>
            </thead>
            <tbody>
              {clipped.map((r, i) => (
                <RingTableRow
                  key={r.id}
                  row={r}
                  isLast={i === clipped.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Tablet + mobil (<1280 px): panel-rækker, samme indhold. */}
      <ul className="flex flex-col gap-3 @[1280px]:hidden">
        {clipped.map((r) => (
          <li key={r.id}>
            <RingPanelRow row={r} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-3 text-right">
          {/* Brief 74 §1 (22. sep 2026): tallet er fjernet fra label.
              Ringelistens definition (overdue + fem hverdage uden kontakt)
              er strammere end priority_status=overdue, som destinationen
              filtrerer på — så samme tal på begge sider var pr. definition
              en løgn. Vælg ærligheden frem for at tvinge definitionerne
              sammen. */}
          <Link
            to="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
            className="text-[13px] font-medium text-[var(--fg-2)] no-underline hover:underline"
          >
            Se alle overskredne →
          </Link>
        </div>
      )}
    </WidgetShell>
  );
}

function RingTableRow({ row, isLast }: { row: EnrichedRow; isLast: boolean }) {
  const [regOpen, setRegOpen] = useState(false);
  const rowCls = isLast ? "" : "border-b border-[var(--line)]";
  return (
    <tr className={rowCls}>
      <td className="px-3 py-3">
        <Link
          to={`/companies/${row.id}/show`}
          className="text-base font-bold text-[var(--fg)] no-underline hover:underline"
        >
          {row.name}
        </Link>
        {row.city && (
          <div className="text-[13px] text-[var(--fg-2)]">{row.city}</div>
        )}
        {row.besoegsfrekvens_note && (
          <div className="mt-0.5 text-[12px] italic text-[var(--fg-2)]">
            »{row.besoegsfrekvens_note}«
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        {row.segment && (
          <Badge
            variant="outline"
            className="border-[var(--line-strong)] text-[12px] font-normal text-[var(--fg-2)]"
          >
            {row.segment}
          </Badge>
        )}
      </td>
      <td className="px-3 py-3 text-[var(--fg-2)]">{row.distrikt ?? "—"}</td>
      <td className="px-3 py-3 text-right">
        <StatusPill variant="red">{humanOverdue(row.daysOverdue)}</StatusPill>
      </td>
      <td className="px-3 py-3 tabular-nums text-[13px] text-[var(--fg-2)]">
        {row.last_visit_at
          ? dateFmt.format(new Date(row.last_visit_at))
          : "aldrig"}
      </td>
      <td
        className="px-3 py-3 text-[var(--fg-2)]"
        title={row.visma_sales_name ?? undefined}
      >
        {shortenSalesName(row.visma_sales_name) ?? "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => setRegOpen(true)}
            className="min-h-11 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
          >
            <Icon icon={Phone} size="sm" />
            Ring op
          </Button>
          <RowActionsMenu
            actions={[
              {
                label: "Registrér samtale",
                onSelect: () => setRegOpen(true),
              },
              {
                label: "Åbn kunde",
                onSelect: () => {
                  window.location.hash = `/companies/${row.id}/show`;
                },
              },
            ]}
          />
        </div>
        <RegistrerModal
          open={regOpen}
          onOpenChange={setRegOpen}
          companyId={row.id}
          companyName={row.name}
          initialTab="aktivitet"
        />
      </td>
    </tr>
  );
}

function RingPanelRow({ row }: { row: EnrichedRow }) {
  const [regOpen, setRegOpen] = useState(false);
  return (
    <article className="flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/companies/${row.id}/show`}
            className="block truncate text-base font-bold text-[var(--fg)] no-underline hover:underline"
          >
            {row.name}
          </Link>
          <div className="text-sm text-[var(--fg-2)]">
            {row.city ?? "—"}
            {row.segment && ` · Segment ${row.segment}`}
            {row.distrikt && ` · ${row.distrikt}`}
          </div>
          <div
            className="text-[13px] text-[var(--fg-2)]"
            title={row.visma_sales_name ?? undefined}
          >
            Sælger: {shortenSalesName(row.visma_sales_name) ?? "—"}
          </div>
          {row.besoegsfrekvens_note && (
            <div className="mt-1 text-[13px] italic text-[var(--fg-2)]">
              »{row.besoegsfrekvens_note}«
            </div>
          )}
        </div>
        <StatusPill variant="red">{humanOverdue(row.daysOverdue)}</StatusPill>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-red-fg)]">
        <Icon icon={AlertTriangle} size="sm" />
        {row.last_visit_at
          ? `Sidste kontakt ${dateFmt.format(new Date(row.last_visit_at))}`
          : "Ingen tidligere kontakt registreret"}
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setRegOpen(true)}
          className="min-h-11 flex-1 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          <Icon icon={Phone} size="sm" />
          Ring op
        </Button>
        <RowActionsMenu
          actions={[
            {
              label: "Registrér samtale",
              onSelect: () => setRegOpen(true),
            },
            {
              label: "Åbn kunde",
              onSelect: () => {
                window.location.hash = `/companies/${row.id}/show`;
              },
            },
          ]}
        />
      </div>
      <RegistrerModal
        open={regOpen}
        onOpenChange={setRegOpen}
        companyId={row.id}
        companyName={row.name}
        initialTab="aktivitet"
      />
    </article>
  );
}
