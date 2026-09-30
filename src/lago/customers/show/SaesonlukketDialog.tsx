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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";
import { saveSaesonlukket } from "@/lago/customers/dataAccess";

/**
 * Brief 90 §3 (28. sep 2026) · Sæsonlukket-periode.
 *
 * En periode, ikke et flueben. Kunden lukker sig ude af ringelisten og
 * "Kunder der skal besøges" i vinduet [fra;til] og åbner sig af sig
 * selv når datoen passerer. Uret nulstilles ikke.
 *
 * Én dialog med to input (fra + til) og en "Ryd"-knap hvis der allerede
 * er en periode. Ingen note — perioden forklarer sig selv, og kunden
 * har allerede besoegsfrekvens_note til andet.
 */

interface SaesonlukketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  initial: {
    saesonlukket_fra: string | null;
    saesonlukket_til: string | null;
  };
}

const datoFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function SaesonlukketDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  initial,
}: SaesonlukketDialogProps) {
  const invalidate = useInvalidateAfterWrite();
  const qc = useQueryClient();
  const [fra, setFra] = useState(initial.saesonlukket_fra ?? "");
  const [til, setTil] = useState(initial.saesonlukket_til ?? "");

  useEffect(() => {
    if (!open) return;
    setFra(initial.saesonlukket_fra ?? "");
    setTil(initial.saesonlukket_til ?? "");
  }, [open, initial]);

  const hasCurrent =
    !!initial.saesonlukket_fra && !!initial.saesonlukket_til;
  const bothFilled = !!fra && !!til;
  const validRange = !bothFilled || til >= fra;

  const save = useMutation({
    mutationFn: (payload: {
      saesonlukket_fra: string | null;
      saesonlukket_til: string | null;
    }) =>
      saveSaesonlukket({
        company_id: companyId,
        saesonlukket_fra: payload.saesonlukket_fra,
        saesonlukket_til: payload.saesonlukket_til,
      }),
    onSuccess: (_, payload) => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
      qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
      qc.invalidateQueries({ queryKey: ["lago-ringeliste"] });
      if (payload.saesonlukket_fra && payload.saesonlukket_til) {
        toast.success(
          `Sæsonlukket til ${datoFmt.format(new Date(payload.saesonlukket_til))}`,
        );
      } else {
        toast.success("Sæsonlukning ryddet");
      }
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme sæsonlukning", {
        description: readErrorMessage(err),
      }),
  });

  const handleGem = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!bothFilled || !validRange) return;
    save.mutate({ saesonlukket_fra: fra, saesonlukket_til: til });
  };

  const handleRyd = () => {
    if (save.isPending) return;
    save.mutate({ saesonlukket_fra: null, saesonlukket_til: null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Sæsonlukket · {companyName}</DialogTitle>
          <DialogDescription className="sr-only">
            Sæt en periode hvor kunden er sæsonlukket. I vinduet er hun
            ude af ringelisten og "Kunder der skal besøges", og åbner sig
            af sig selv når datoen passerer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGem} className="flex flex-col">
          <div className="space-y-4 px-6 pt-3 pb-4">
            <p className="text-sm text-[var(--fg-2)]">
              I perioden er kunden ude af ringelisten og af "Kunder der
              skal besøges". Uret sættes på pause — når vinduet slutter,
              er overskridelsen den samme som før.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="saesonlukket-fra" className="text-sm">
                  Fra
                </Label>
                <Input
                  id="saesonlukket-fra"
                  type="date"
                  value={fra}
                  onChange={(e) => setFra(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="saesonlukket-til" className="text-sm">
                  Til (og med)
                </Label>
                <Input
                  id="saesonlukket-til"
                  type="date"
                  value={til}
                  onChange={(e) => setTil(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            {bothFilled && !validRange && (
              <p className="text-[13px] text-[var(--st-red-fg)]">
                Slutdato skal være samme dag eller senere end startdato.
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-between">
            {hasCurrent ? (
              <button
                type="button"
                onClick={handleRyd}
                disabled={save.isPending}
                className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
              >
                Ryd sæsonlukning
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
              >
                Annullér
              </button>
              <Button
                type="submit"
                disabled={save.isPending || !bothFilled || !validRange}
                className="min-w-[120px] gap-2 bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
              >
                {save.isPending && (
                  <Icon icon={Loader2} className="animate-spin" />
                )}
                Gem
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
