import { useQuery } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { OrdreKommentarDialog } from "@/lago/customers/show/OrdreKommentarDialog";

import { WidgetShell } from "../WidgetShell";

/**
 * Kunder med ordrer, der kan sendes (brief 90 §4 · 28. sep 2026).
 *
 * Det eneste sted på kontorets skærm, hvor der ligger omsætning, der
 * kan realiseres i dag. Kilde: dashboard_kan_sendes_lago RPC.
 *
 * Definition — fra ordbogen, ikke fra hukommelsen:
 *   - hele ordren klar: BOOL_AND(lagerstatus = 'klar')
 *   - antal_faerdigmeldt = 0 på alle linjer
 *   - undtages_lagerhaandtering ikke true på nogen linje
 *   - Levering = 0. Reservationer (5) og MAV (mav=true) hører ikke her —
 *     de venter med vilje
 *   - En Primeur (status LIKE '21%') er også ude
 *
 * Kreditspærrede mærkes, skjules ikke: varen er klar; den må bare ikke
 * af sted.
 *
 * Handling per række: Kommentér — samme dialog som brief 89, så
 * kontoret kan svare sælgeren tilbage. Ordre-numre for kunden pases
 * ind i dialogen, så kommentaren fæstnes til de rigtige ordrer.
 */

interface OrdreNote {
  ordre_nr: string;
  note: string;
}

interface KanSendesRow {
  company_id: number;
  kunde: string;
  sales_id: number | null;
  visma_customer_no: string;
  segment: string | null;
  distrikt: string | null;
  visma_sales_name: string | null;
  kreditspaerre: boolean | null;
  antal_ordrer: number;
  beloeb: number | string;
  aeldste_ordredato: string | null;
  ordre_numre: string[];
  ordre_noter: OrdreNote[];
  // §21 (29. sep 2026): passeret oensket_leveringsdato bubbles op til
  // kunden. RPC'en har allerede sorteret dem øverst; markøren fortæller
  // hvorfor.
  har_passeret_dato?: boolean;
  aeldste_passeret_dato?: string | null;
}

interface Payload {
  rows: KanSendesRow[];
  total: number;
  total_ordrer: number;
  total_beloeb: number | string;
}

const CLIP_TO = 5;

async function fetchKanSendes(): Promise<Payload> {
  const supabase = getSupabaseClient();
  // §11f opfølgning (29. sep 2026): p_limit=500 så "Se alle"-dialogen
  // kan vise samtlige rækker uden en ekstra query. 39 kunder × ~500 B
  // = ~20 KB — det holder på et par år endnu.
  const { data, error } = await supabase.rpc("dashboard_kan_sendes_lago", {
    p_limit: 500,
  });
  if (error) throw error;
  const payload = data as Payload | null;
  return {
    rows: payload?.rows ?? [],
    total: payload?.total ?? 0,
    total_ordrer: payload?.total_ordrer ?? 0,
    total_beloeb: payload?.total_beloeb ?? 0,
  };
}

const kroneFmt = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const datoFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
});

function toNum(v: string | number): number {
  return typeof v === "string" ? Number(v) : v;
}

function alderIDage(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function KanSendesTable({
  rows,
  onKommenter,
}: {
  rows: KanSendesRow[];
  onKommenter: (r: KanSendesRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
            <th className="pb-2 pr-3 font-medium">Kunde</th>
            <th className="pb-2 pr-3 text-right font-medium">Ordrer</th>
            <th className="pb-2 pr-3 text-right font-medium">Beløb</th>
            <th className="pb-2 pr-3 font-medium">Ældste</th>
            <th className="pb-2 text-right font-medium">Handling</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // Brief 90 opfølgning (29. sep 2026): tærskel højnet så
            // farven bærer noget. Listen er sorteret på beløb, så
            // farven er den eneste signalbærer om alder — den skal
            // skille sig ud, ikke gælde alt. 60 dg rød, 30 dg gul.
            const alder = alderIDage(r.aeldste_ordredato);
            const alderCls =
              alder != null && alder >= 60
                ? "text-[var(--st-red-fg)]"
                : alder != null && alder >= 30
                  ? "text-[var(--st-amber-fg)]"
                  : "text-[var(--fg-2)]";
            return (
              <tr key={r.company_id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">
                  <div>
                    <Link
                      to={`/companies/${r.company_id}/show`}
                      className="font-medium text-[var(--fg)] no-underline hover:underline"
                    >
                      {r.kunde}
                    </Link>
                    {r.kreditspaerre === true && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-[var(--st-red-fg)] text-[11px] font-normal text-[var(--st-red-fg)]"
                      >
                        Kreditspærret
                      </Badge>
                    )}
                    {r.har_passeret_dato && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-[var(--st-red-fg)] text-[11px] font-normal text-[var(--st-red-fg)]"
                      >
                        Aftalt dato passeret
                        {r.aeldste_passeret_dato &&
                          ` · ${datoFmt.format(new Date(r.aeldste_passeret_dato))}`}
                      </Badge>
                    )}
                    {r.segment && (
                      <span className="ml-2 text-[12px] text-[var(--fg-3)]">
                        {r.segment}
                      </span>
                    )}
                  </div>
                  {r.ordre_noter && r.ordre_noter.length > 0 && (
                    <NoteRowInline noter={r.ordre_noter} />
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.antal_ordrer}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {kroneFmt.format(toNum(r.beloeb))}
                </td>
                <td className="py-2 pr-3 text-[13px]">
                  {r.aeldste_ordredato && (
                    <span className={alderCls}>
                      {datoFmt.format(new Date(r.aeldste_ordredato))}
                      {alder != null && ` · ${alder} dg`}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onKommenter(r);
                    }}
                    className="h-8 bg-[var(--surface-3)] font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80"
                  >
                    Opfølgning
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NoteRowInline({ noter }: { noter: OrdreNote[] }) {
  if (noter.length === 1) {
    const n = noter[0];
    return (
      <div className="mt-0.5 flex items-start gap-1 text-[12px] text-[var(--fg-2)]">
        <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          <span className="text-[var(--fg-3)]">#{n.ordre_nr}:</span>{" "}
          <span className="text-[var(--fg)]">{n.note}</span>
        </span>
      </div>
    );
  }
  const first = noter[0];
  const rest = noter.length - 1;
  return (
    <div className="mt-0.5 flex items-start gap-1 text-[12px] text-[var(--fg-2)]">
      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        <span className="text-[var(--fg-3)]">#{first.ordre_nr}:</span>{" "}
        <span className="text-[var(--fg)]">{first.note}</span>{" "}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-[var(--fg-3)] underline underline-offset-2 hover:text-[var(--fg)]"
              onClick={(e) => e.stopPropagation()}
            >
              +{rest} mere
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-2 text-[13px]">
            <div className="text-[12px] font-medium text-[var(--fg-2)]">
              Noter fra LAGO
            </div>
            <ul className="space-y-2">
              {noter.map((n) => (
                <li
                  key={n.ordre_nr}
                  className="border-t border-[var(--line)] pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="text-[12px] text-[var(--fg-3)]">
                    Ordre #{n.ordre_nr}
                  </div>
                  <div className="text-[var(--fg)]">{n.note}</div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </span>
    </div>
  );
}

export function KanSendesWidget() {
  const query = useQuery({
    queryKey: ["lago-kan-sendes"],
    queryFn: fetchKanSendes,
    staleTime: 60_000,
  });

  const [dialogFor, setDialogFor] = useState<KanSendesRow | null>(null);
  const [seAlleAaben, setSeAlleAaben] = useState(false);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const clipped = rows.slice(0, CLIP_TO);
  // Brief 90 opfølgning (29. sep 2026): grand-totals kommer fra RPC nu,
  // ikke fra top-N-summering. "37 kunder · 25 ordrer" var umulig fordi
  // 25 var top-5-summen mens 37 var alle kunder — nu er begge tal fra
  // samme univers.
  const totalBeloeb = toNum(query.data?.total_beloeb ?? 0);
  const totalOrdrer = query.data?.total_ordrer ?? 0;

  return (
    <WidgetShell
      title="Kunder med ordrer, der kan sendes"
      subtitle="Hele ordren klar · almindelig levering · rangeret på beløb"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={total === 0}
      count={
        total > 0
          ? {
              label: `${total} kunder · ${kroneFmt.format(totalBeloeb)}`,
              tone: "neutral",
            }
          : undefined
      }
      emptyState="Ingen ordrer klar til afsendelse lige nu."
    >
      <KanSendesTable rows={clipped} onKommenter={setDialogFor} />
      {total > clipped.length && (
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[var(--fg-3)]">
            {total} kunder · {totalOrdrer} ordrer ·{" "}
            {kroneFmt.format(totalBeloeb)} i alt
          </span>
          <button
            type="button"
            onClick={() => setSeAlleAaben(true)}
            className="text-[13px] font-medium text-[var(--fg)] underline underline-offset-2 hover:text-[var(--fg-2)]"
          >
            Se alle {total} →
          </button>
        </div>
      )}
      <Dialog open={seAlleAaben} onOpenChange={setSeAlleAaben}>
        <DialogContent
          className="flex max-h-[85vh] flex-col sm:max-w-5xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Kunder med ordrer, der kan sendes</DialogTitle>
            <p className="text-[13px] text-[var(--fg-3)]">
              {total} kunder · {totalOrdrer} ordrer ·{" "}
              {kroneFmt.format(totalBeloeb)} i alt
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <KanSendesTable rows={rows} onKommenter={setDialogFor} />
          </div>
        </DialogContent>
      </Dialog>
      {dialogFor && (
        <OrdreKommentarDialog
          open={!!dialogFor}
          onOpenChange={(v) => {
            if (!v) setDialogFor(null);
          }}
          companyId={dialogFor.company_id}
          companyName={dialogFor.kunde}
          ordreNumre={dialogFor.ordre_numre}
        />
      )}
    </WidgetShell>
  );
}
