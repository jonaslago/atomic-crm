import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";

/**
 * §98-2b (2. okt 2026): klikbart ordrenummer → modal med ordredetaljer.
 *
 * Same data as the customer card's expanded order. Product names from
 * products_lago — same lookup as useOpenOrders.
 */

interface OrdreDetaljeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ordreNr: string;
}

interface OrdreLinje {
  linje_nr: string;
  produktnr: string | null;
  antal: number | null;
  ej_faktureret: number | null;
  lagerstatus_effective: string | null;
  oensket_leveringsdato: string | null;
  note: string | null;
  er_par_komponent: boolean | null;
}

interface DisplayLine extends OrdreLinje {
  produktnavn: string;
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function OrdreDetaljeDialog({
  open,
  onOpenChange,
  ordreNr,
}: OrdreDetaljeDialogProps) {
  const query = useQuery({
    queryKey: ["lago-ordre-detalje", ordreNr],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("open_orders_effective_lago")
        .select(
          "linje_nr, produktnr, antal, ej_faktureret, lagerstatus_effective, oensket_leveringsdato, note, er_par_komponent",
        )
        .eq("ordre_nr", ordreNr)
        .order("linje_nr", { ascending: true });
      if (error) throw error;
      const lines = (data ?? []) as OrdreLinje[];

      // Product name lookup — same as useOpenOrders + FaktureretSection
      const allNr = new Set(
        lines.map((l) => l.produktnr).filter((n): n is string => n != null),
      );
      const navnByNr = new Map<string, string>();
      if (allNr.size > 0) {
        const { data: pData } = await supabase
          .from("products_lago")
          .select("produktnr, beskrivelse")
          .in("produktnr", [...allNr]);
        for (const p of (pData ?? []) as Array<{
          produktnr: string;
          beskrivelse: string | null;
        }>) {
          if (p.beskrivelse) navnByNr.set(p.produktnr, p.beskrivelse);
        }
      }

      return lines.map(
        (l): DisplayLine => ({
          ...l,
          produktnavn: navnByNr.get(l.produktnr ?? "") ?? l.produktnr ?? "—",
        }),
      );
    },
    enabled: open,
    staleTime: 30_000,
  });

  const lines = query.data ?? [];
  const visibleLines = lines.filter((l) => !l.er_par_komponent);
  const total = visibleLines.reduce((s, l) => s + (l.ej_faktureret ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordre #{ordreNr}</DialogTitle>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--fg-2)]">
            <Icon icon={Loader2} className="animate-spin" />
            Henter ordrelinjer…
          </div>
        ) : visibleLines.length === 0 ? (
          <p className="py-4 text-sm text-[var(--fg-2)]">
            Ingen linjer fundet.
          </p>
        ) : (
          <>
            <ul className="flex flex-col">
              {visibleLines.map((l) => (
                <li
                  key={l.linje_nr}
                  className="flex items-baseline gap-3 border-t border-[var(--line)] py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
                    {l.produktnavn}
                    {l.produktnavn !== (l.produktnr ?? "") && (
                      <span className="ml-1 text-[var(--fg-3)]">
                        {l.produktnr}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[length:var(--t-meta)] tabular-nums text-[var(--fg-2)]">
                    {l.antal ?? 0} stk.
                  </span>
                  <span className="shrink-0 text-sm tabular-nums font-medium text-[var(--fg)]">
                    {(l.ej_faktureret ?? 0) === 0 && (l.antal ?? 0) > 0
                      ? "0 kr."
                      : `${krFmt.format(l.ej_faktureret ?? 0)} kr.`}
                  </span>
                  <span className="shrink-0 text-[length:var(--t-meta)] text-[var(--fg-3)]">
                    {l.lagerstatus_effective ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t-2 border-[var(--fg-3)] py-2 font-bold">
              <span className="text-sm text-[var(--fg)]">I alt</span>
              <span className="text-sm tabular-nums text-[var(--fg)]">
                {krFmt.format(total)} kr.
              </span>
            </div>
            {visibleLines.some((l) => l.note) && (
              <div className="space-y-1 border-t border-[var(--line)] pt-3">
                {visibleLines
                  .filter((l) => l.note)
                  .map((l) => (
                    <p
                      key={l.linje_nr}
                      className="text-[13px] text-[var(--fg-2)]"
                    >
                      {l.note}
                    </p>
                  ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
