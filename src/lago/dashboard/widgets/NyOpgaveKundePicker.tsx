import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Icon } from "@/lago/ui/Icon";

/**
 * Brief 85 §16 tillæg (28. sep 2026) · kunde-vælger til "Ny opgave".
 *
 * Sælgeren klikker "+ Ny opgave" i Åbne opgaver-widget. Vi ved endnu
 * ikke, hvilken kunde det gælder — dialogen viser en søgeliste over
 * sælgerens egne kunder (samme filter som resten af widget'en bruger).
 * Klik på en række lukker dialogen og returnerer kunden til parent,
 * som åbner RegistrerModal med initialTab="opgave" på den kunde.
 *
 * To-trins-flow (vælg kunde → skriv opgave) er valgt over ét-trins fordi:
 *  1) OpgaveForm i RegistrerModal ved allerede kontakt-flowet (inline
 *     opret hvis kunden mangler kontakt) — genbrug frem for kopiering.
 *  2) Kunde-picker kan bruges igen senere til andre "hurtig-handling"-
 *     flows uden nye former for hver.
 */

interface NyOpgaveKundePickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (company: { id: number; name: string }) => void;
}

export function NyOpgaveKundePicker({
  open,
  onOpenChange,
  onSelect,
}: NyOpgaveKundePickerProps) {
  const mySalesId = useViewSalesId();
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["lago-ny-opgave-kunder", mySalesId],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: open && mySalesId != null,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows.slice(0, 20);
    return rows
      .filter((r) => {
        const hay = [r.name, r.city ?? ""].join(" ").toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 20);
  }, [query.data, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Ny opgave — vælg kunde</DialogTitle>
          <DialogDescription>
            Søg efter en af dine kunder. Vælg for at skrive opgaven.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-[var(--line)] px-6 pt-1 pb-3">
          <div className="relative">
            <Icon
              icon={Search}
              size="sm"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--fg-3)]"
            />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kundenavn eller by"
              className="pl-9"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {query.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Icon icon={Loader2} className="animate-spin" />
              Henter kunder …
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              {q.trim()
                ? "Ingen kunder matcher søgningen."
                : "Du har ikke fået tildelt kunder endnu."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ id: row.id, name: row.name });
                      onOpenChange(false);
                      setQ("");
                    }}
                    className="flex w-full min-h-11 items-baseline gap-3 rounded-md px-4 py-2 text-left hover:bg-[var(--surface-1)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">
                      {row.name}
                    </span>
                    {row.city && (
                      <span className="shrink-0 text-[13px] text-[var(--fg-3)]">
                        {row.city}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
