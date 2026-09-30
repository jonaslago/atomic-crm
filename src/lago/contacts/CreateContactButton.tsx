import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lago/ui/Icon";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { ContactDialog } from "@/lago/customers/show/ContactDialog";

/**
 * Brief 56 §5 · "Opret kontakt".
 *
 * Kontakter er tilknyttet en kunde (contacts.company_id NOT NULL), så vi
 * må først vide hvilken. To sekventielle dialogs holder state simpel:
 *
 *   1) Vælg kunde — søg i sælger-synlige, aktive kunder
 *   2) ContactDialog fra brief 46 §4 med den valgte company_id
 *
 * ContactDialog invaliderer selv relevante caches, så listen opdaterer
 * sig via samme mekanisme som når en kontakt tilføjes fra kundekortet.
 */
export function CreateContactButton() {
  const [pickOpen, setPickOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(
    null,
  );

  return (
    <>
      <Button
        onClick={() => setPickOpen(true)}
        className="min-h-11 gap-2 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
      >
        <Icon icon={Plus} size="sm" />
        Opret kontakt
      </Button>

      <PickCustomerDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        onPicked={(c) => {
          setPickOpen(false);
          setPicked(c);
        }}
      />

      {picked && (
        <ContactDialog
          open={!!picked}
          onOpenChange={(v) => {
            if (!v) setPicked(null);
          }}
          companyId={picked.id}
          companyName={picked.name}
        />
      )}
    </>
  );
}

interface PickCustomerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPicked: (c: { id: number; name: string }) => void;
}

function PickCustomerDialog({
  open,
  onOpenChange,
  onPicked,
}: PickCustomerDialogProps) {
  const [query, setQuery] = useState("");

  // Genbruger customer-list-cachen — hvis brugeren har været på
  // kundelisten er den varm. Ellers en enkelt roundtrip.
  const list = useQuery({
    queryKey: ["lago-customer-list", { onlyMine: false }],
    queryFn: () => fetchCustomerList({}),
    staleTime: 60_000,
    enabled: open,
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!q) return rows.slice(0, 20);
    return rows
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.city ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [list.data, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-[var(--line)] px-4 py-3">
          <DialogTitle className="text-base">Vælg kunde</DialogTitle>
          <DialogDescription className="sr-only">
            Vælg den kunde kontakten skal tilknyttes.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-[var(--line)] px-4 py-3">
          <div className="relative">
            <Icon
              icon={Search}
              size="sm"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-3)]"
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg på navn eller by…"
              className="min-h-11 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {list.isPending ? (
            <div className="px-4 py-6 text-sm text-[var(--fg-2)]">
              Henter kunder…
            </div>
          ) : list.error ? (
            // #200 §2 (18. sep 2026): tavs fejl viste tidligere "Ingen
            // kunder matcher" — falsk-tom. Uden explicit fejl-blok
            // kunne sælgeren ikke se forskellen på "listen er tom" og
            // "opslaget fejlede".
            <div className="px-4 py-6 text-sm text-[var(--st-red-fg)]">
              Kunne ikke hente kunderne. Prøv at genindlæse.
            </div>
          ) : matches.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--fg-2)]">
              Ingen kunder matcher.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPicked({ id: c.id, name: c.name })}
                    className="flex w-full min-h-11 items-baseline gap-3 px-4 py-3 text-left hover:bg-[var(--surface-1)]"
                  >
                    <span className="text-sm font-medium text-[var(--fg)]">
                      {c.name}
                    </span>
                    {c.city && (
                      <span className="text-[13px] text-[var(--fg-3)]">
                        {c.city}
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
