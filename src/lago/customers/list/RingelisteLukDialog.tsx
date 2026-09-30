import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { createRingelisteLukning } from "@/lago/customers/dataAccess";

/**
 * Brief 90 §2 (28. sep 2026) · Luk ringeliste-post med begrundelse.
 *
 * Skjuler kunden fra ringelisten indtil et besøg, en ordre eller +14
 * dages ny overskridelse. Simon ringer ikke to gange på samme grund.
 * Uden begrundelse ingen lukning — feltet er required, både for at
 * han selv husker det og for at kontoret kan efterse kollektivt.
 */

interface RingelisteLukDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  /** Kopieres ind i lukningen så auto-luk-reglen kan sammenligne. */
  lastVisitAtVedLukning: string | null;
  daysOverdueVedLukning: number | null;
}

export function RingelisteLukDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  lastVisitAtVedLukning,
  daysOverdueVedLukning,
}: RingelisteLukDialogProps) {
  const qc = useQueryClient();
  const actorSalesId = useActorSalesId();
  const [begrundelse, setBegrundelse] = useState("");

  useEffect(() => {
    if (!open) return;
    setBegrundelse("");
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      createRingelisteLukning({
        company_id: companyId,
        begrundelse: begrundelse.trim(),
        last_visit_at_ved_lukning: lastVisitAtVedLukning,
        days_overdue_ved_lukning: daysOverdueVedLukning,
        lukket_af: actorSalesId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
      qc.invalidateQueries({ queryKey: ["lago-ringeliste"] });
      qc.invalidateQueries({ queryKey: ["lago-ringeliste-lukninger"] });
      qc.invalidateQueries({ queryKey: ["lago-taellerraekke"] });
      toast.success(`${companyName} lukket fra ringelisten`, {
        description:
          "Åbner igen ved næste besøg, ny ordre eller +14 dages overskridelse.",
      });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke lukke ringeliste-post", {
        description: readErrorMessage(err),
      }),
  });

  const valid = begrundelse.trim().length > 0;

  const handleGem = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending || !valid) return;
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Luk fra ringelisten · {companyName}</DialogTitle>
          <DialogDescription className="sr-only">
            Skriv hvorfor kunden ikke skal stå på ringelisten. Kunden
            forsvinder fra listen indtil noget reelt ændrer sig.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGem} className="flex flex-col">
          <div className="space-y-3 px-6 pt-3 pb-4">
            <p className="text-sm text-[var(--fg-2)]">
              Kunden forsvinder fra listen. Hun kommer tilbage af sig selv
              hvis der bookes et besøg, kommer en ordre eller går 14 dage
              mere ud over intervallet.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ring-begrundelse" className="text-sm">
                Begrundelse
              </Label>
              <Textarea
                id="ring-begrundelse"
                rows={4}
                value={begrundelse}
                onChange={(e) => setBegrundelse(e.target.value)}
                placeholder='fx "Har talt med hende — hun er på ferie i tre uger."'
                className="text-sm"
                required
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
            >
              Annullér
            </button>
            <Button
              type="submit"
              disabled={save.isPending || !valid}
              className="min-w-[120px] gap-2 bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
            >
              {save.isPending && (
                <Icon icon={Loader2} className="animate-spin" />
              )}
              Luk fra listen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
