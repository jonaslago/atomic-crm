import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Icon } from "@/lago/ui/Icon";

/**
 * Bekræftelse på "Send videre til kontoret" (brief 87 §5-hastesag,
 * 28. sep 2026).
 *
 * Hændelsen: Jonas sendte ved et uheld task 23 (Ring til Paw / Rombo.dk)
 * til kontoret via den nye ikonknap. Før i dag lå Send videre bag ⋯-
 * menuen, hvor sælgeren skulle læse tekst før tryk — vi fjernede
 * friktionen uden at erstatte den. Rulle-tilbagen blev logget som
 * `genaabnet` i task_events_lago.
 *
 * Bekræftelsen NAVNGIVER hvad der sendes:
 *   - opgavens tekst (line-clamp så en lang note ikke sprænger dialogen)
 *   - kundens navn
 *   - under dækning: "Dette er {navn}s opgave." — så coveren ved at
 *     handlingen ændrer en andens flade
 *
 * Knapper: "Send til kontoret" (primær) og "Fortryd" (sekundær).
 * Aldrig "OK" — teksten skal sige hvad der sker.
 *
 * Gælder ALLE bredder — også menu-varianten under 1024 px. Friktionen
 * hører i handlingen, ikke i navigationen.
 */

interface SendVidereDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskText: string;
  companyName: string | null;
  isCovering: boolean;
  coveredName: string | null;
  onConfirm: () => void;
  pending: boolean;
}

export function SendVidereDialog({
  open,
  onOpenChange,
  taskText,
  companyName,
  isCovering,
  coveredName,
  onConfirm,
  pending,
}: SendVidereDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={Send} className="text-[var(--ink)]" />
            Send videre til kontoret?
          </DialogTitle>
          <DialogDescription>
            Kontoret overtager opgaven. Den forsvinder fra dine åbne og
            tilføjes deres liste.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <div className="text-[13px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
              Opgave
            </div>
            <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--fg)]">
              {taskText.trim() || "(uden tekst)"}
            </p>
          </div>
          {companyName && (
            <div>
              <div className="text-[13px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
                Kunde
              </div>
              <p className="mt-0.5 text-sm text-[var(--fg)]">{companyName}</p>
            </div>
          )}
          {isCovering && coveredName && (
            <p className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
              Dette er {coveredName}s opgave.
            </p>
          )}
        </div>
        <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Fortryd
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
          >
            {pending ? "Sender …" : "Send til kontoret"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
