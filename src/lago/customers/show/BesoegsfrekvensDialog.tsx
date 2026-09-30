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
import { Textarea } from "@/components/ui/textarea";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";
import { saveBesoegsfrekvens } from "@/lago/customers/dataAccess";

/**
 * Brief 65 (18. sep 2026) · Besoegsfrekvens override
 *
 * Modal med to sider:
 *   ○ Brug standarden        → NULL, note ryddes med
 *   ● Egen frekvens [N] dage → 7..365, note valgfri
 *
 * §5-regler:
 *   1. "Brug standarden" siger EKSPLICIT at noten slettes — så ingen
 *      taber en note ved uheld.
 *   2. Valgt egen frekvens UDEN note → ét spørgsmål "vil du skrive
 *      hvorfor? Den næste, der ser kunden, ved det ikke." Ét spørgsmål,
 *      ikke en spærring — der er kunder hvor frekvensen taler for sig
 *      selv (nyåbnet butik = tættere kadence).
 */

interface BesoegsfrekvensDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  segment: "A" | "B" | "C" | "X" | "L" | null;
  defaultIntervalDays: number | null;
  initial: {
    besoegsfrekvens_dage: number | null;
    besoegsfrekvens_note: string | null;
  };
  currentSalesId: number;
}

type Mode = "standard" | "custom";

function segmentLabel(seg: "A" | "B" | "C" | "X" | "L" | null): string {
  if (seg === "A") return "segment A";
  if (seg === "B") return "segment B";
  if (seg === "C") return "segment C";
  if (seg === "X") return "segment X";
  if (seg === "L") return "lead";
  return "ukendt segment";
}

export function BesoegsfrekvensDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  segment,
  defaultIntervalDays,
  initial,
  currentSalesId,
}: BesoegsfrekvensDialogProps) {
  const invalidate = useInvalidateAfterWrite();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(
    initial.besoegsfrekvens_dage != null ? "custom" : "standard",
  );
  const [dage, setDage] = useState<string>(
    initial.besoegsfrekvens_dage != null
      ? String(initial.besoegsfrekvens_dage)
      : String(defaultIntervalDays ?? 60),
  );
  const [note, setNote] = useState<string>(initial.besoegsfrekvens_note ?? "");
  // Én-gang confirm-flag når man gemmer "custom" uden note.
  const [noteConfirmed, setNoteConfirmed] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setMode(initial.besoegsfrekvens_dage != null ? "custom" : "standard");
    setDage(
      initial.besoegsfrekvens_dage != null
        ? String(initial.besoegsfrekvens_dage)
        : String(defaultIntervalDays ?? 60),
    );
    setNote(initial.besoegsfrekvens_note ?? "");
    setNoteConfirmed(false);
  }, [open, initial, defaultIntervalDays]);

  const dageNumber = Number.parseInt(dage, 10);
  const dageValid =
    mode === "standard" ||
    (Number.isFinite(dageNumber) && dageNumber >= 7 && dageNumber <= 365);

  const save = useMutation({
    mutationFn: async () => {
      const nextDage = mode === "standard" ? null : dageNumber;
      const nextNote =
        mode === "standard" ? null : note.trim() ? note.trim() : null;
      await saveBesoegsfrekvens({
        company_id: companyId,
        besoegsfrekvens_dage: nextDage,
        besoegsfrekvens_note: nextNote,
        sales_id_setter: currentSalesId,
      });
    },
    onSuccess: () => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
      qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
      qc.invalidateQueries({ queryKey: ["lago-ringeliste"] });
      toast.success(
        mode === "standard"
          ? "Besøgsfrekvens sat til standard"
          : `Besøgsfrekvens: hver ${dageNumber}. dag`,
      );
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme besøgsfrekvens", {
        description: readErrorMessage(err),
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!dageValid) return;
    // §5 én-gang bekræftelse: custom uden note.
    if (mode === "custom" && !note.trim() && !noteConfirmed) {
      setNoteConfirmed(true);
      return;
    }
    save.mutate();
  };

  const askForNote = mode === "custom" && !note.trim() && noteConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Besøgsfrekvens · {companyName}</DialogTitle>
          <DialogDescription className="sr-only">
            Vælg om kunden følger segmentets standard, eller sæt en egen
            frekvens med en note der forklarer valget.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-4 px-6 pt-3 pb-4">
            {/* Segmentets standard som orientering. */}
            <p className="text-sm text-[var(--fg-2)]">
              Segmentets standard:{" "}
              <span className="text-[var(--fg)]">
                {defaultIntervalDays != null
                  ? `hver ${defaultIntervalDays}. dag`
                  : "ingen kadence"}
              </span>{" "}
              ({segmentLabel(segment)})
            </p>

            {/* Radio: standard vs custom. */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="freq-mode"
                  checked={mode === "standard"}
                  onChange={() => setMode("standard")}
                  className="mt-0.5"
                />
                <span>
                  Brug standarden
                  {mode === "standard" && (
                    <span className="mt-0.5 block text-[length:var(--t-sec)] text-[var(--fg-2)]">
                      Nulstiller frekvensen — og{" "}
                      <span className="font-medium">
                        sletter den eksisterende note
                      </span>
                      .
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="freq-mode"
                  checked={mode === "custom"}
                  onChange={() => setMode("custom")}
                  className="mt-0.5"
                />
                <span className="flex items-baseline gap-2">
                  Egen frekvens
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    step={1}
                    value={dage}
                    onChange={(e) => setDage(e.target.value)}
                    onFocus={() => setMode("custom")}
                    className="h-9 w-20 text-sm"
                    disabled={mode !== "custom"}
                  />
                  <span className="text-[var(--fg-2)]">dage (7–365)</span>
                </span>
              </label>
            </div>

            {/* Note — vises kun i custom-mode. */}
            {mode === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="freq-note" className="text-sm">
                  Hvorfor?{" "}
                  <span className="text-[var(--fg-2)]">
                    (vises på kundekortet og i ringelisten)
                  </span>
                </Label>
                <Textarea
                  id="freq-note"
                  rows={3}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (e.target.value.trim()) setNoteConfirmed(false);
                  }}
                  placeholder="Vil helst bare ringes op / PÆ"
                  className="text-sm"
                />
                {askForNote && (
                  <p className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[length:var(--t-sec)] text-[var(--fg)]">
                    Vil du skrive hvorfor? Den næste, der ser kunden, ved det
                    ikke. Tryk <span className="font-medium">Gem</span> igen for
                    at gemme uden note.
                  </p>
                )}
              </div>
            )}
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
              disabled={save.isPending || !dageValid}
              className="min-w-[120px] gap-2 bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
            >
              {save.isPending && (
                <Icon icon={Loader2} className="animate-spin" />
              )}
              Gem
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
