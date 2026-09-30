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

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";
import { restoreNote, softDeleteNote } from "@/lago/customers/dataAccess";

/**
 * Sletteregler (29. sep 2026) · Slet note med begrundelse.
 *
 * Begrundelse er valgfri når man sletter egen note, påkrævet når man
 * sletter en andens (canEditNote lader admin slette alt). Samme skelnen
 * som canEditNote — hvis en admin trykker slet på Peters note, skal
 * han sige hvorfor.
 *
 * Sletningen skrives til sletninger_lago via triggeren; RPC'en bærer
 * begrundelsen ind via SET LOCAL. Fortryd-toast'en kalder restore_note
 * i 5 sekunder efter sletningen — samme opførsel som aktiviteter.
 */

interface SletNoteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: number;
  companyId: number;
  noteText: string;
  /** True hvis noten ikke tilhører den aktuelle bruger. Så bliver
   *  begrundelses-feltet påkrævet. */
  isSomeoneElses: boolean;
  ownerName: string | null;
}

export function SletNoteDialog({
  open,
  onOpenChange,
  noteId,
  companyId,
  noteText,
  isSomeoneElses,
  ownerName,
}: SletNoteDialogProps) {
  const invalidate = useInvalidateAfterWrite();
  const qc = useQueryClient();
  const [begrundelse, setBegrundelse] = useState("");

  useEffect(() => {
    if (!open) return;
    setBegrundelse("");
  }, [open]);

  const del = useMutation({
    mutationFn: () => softDeleteNote(noteId, begrundelse.trim() || null),
    onSuccess: () => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
      onOpenChange(false);
      toast.success("Note slettet", {
        action: {
          label: "Fortryd",
          onClick: () => {
            void (async () => {
              try {
                await restoreNote(noteId);
                invalidate(companyId);
                qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
                toast.success("Noten er tilbage");
              } catch (err) {
                toast.error("Kunne ikke fortryde", {
                  description: readErrorMessage(err),
                });
              }
            })();
          },
        },
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke slette noten", {
        description: readErrorMessage(err),
      }),
  });

  const valid = !isSomeoneElses || begrundelse.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Slet note?</DialogTitle>
          <DialogDescription className="sr-only">
            Noten fjernes fra kortet. Sletningen logges i sletninger_lago
            og kan fortrydes i toast'en de næste 5 sekunder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-2">
          <div>
            <div className="text-[13px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
              Note
            </div>
            <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--fg)]">
              {noteText || "(uden tekst)"}
            </p>
          </div>
          {isSomeoneElses && ownerName && (
            <p className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
              Noten er skrevet af <span className="font-medium">{ownerName}</span>.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="slet-note-begrundelse" className="text-sm">
              Begrundelse{" "}
              {isSomeoneElses ? (
                <span className="text-[var(--st-red-fg)]">(påkrævet)</span>
              ) : (
                <span className="text-[var(--fg-2)]">(valgfri)</span>
              )}
            </Label>
            <Textarea
              id="slet-note-begrundelse"
              rows={3}
              value={begrundelse}
              onChange={(e) => setBegrundelse(e.target.value)}
              placeholder={
                isSomeoneElses
                  ? "Skriv hvorfor du sletter en andens note."
                  : "Valgfri — hvorfor sletter du den?"
              }
              className="text-sm"
              required={isSomeoneElses}
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
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending || !valid}
            className="min-w-[120px] gap-2 bg-[var(--st-red-fg)] text-white hover:bg-[var(--st-red-fg)]/90"
          >
            {del.isPending && (
              <Icon icon={Loader2} className="animate-spin" />
            )}
            Slet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
