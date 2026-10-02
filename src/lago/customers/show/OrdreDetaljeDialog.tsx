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
 * Same data as the customer card's expanded order: lines, notes, status,
 * amount. Reads from open_orders_effective_lago for the single order.
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

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
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
      return (data ?? []) as OrdreLinje[];
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
                  <th className="pb-2 pr-3 font-medium">Produkt</th>
                  <th className="pb-2 pr-3 text-right font-medium">Antal</th>
                  <th className="pb-2 pr-3 text-right font-medium">Beløb</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium">Dato</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((l) => (
                  <tr
                    key={l.linje_nr}
                    className="border-t border-[var(--line)]"
                  >
                    <td className="py-2 pr-3 text-[var(--fg)]">
                      {l.produktnr ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                      {l.antal ?? 0}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                      {krFmt.format(l.ej_faktureret ?? 0)} kr.
                    </td>
                    <td className="py-2 pr-3 text-[var(--fg-2)]">
                      {l.lagerstatus_effective ?? "—"}
                    </td>
                    <td className="py-2 text-[var(--fg-2)]">
                      {l.oensket_leveringsdato
                        ? dateFmt.format(
                            new Date(l.oensket_leveringsdato + "T12:00:00"),
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--fg-3)] font-bold">
                  <td className="py-2 pr-3 text-[var(--fg)]">I alt</td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                    {krFmt.format(total)} kr.
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2" />
                </tr>
              </tbody>
            </table>
            {/* Notes from the order */}
            {visibleLines.some((l) => l.note) && (
              <div className="mt-3 space-y-1 border-t border-[var(--line)] pt-3">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
