import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useGetIdentity } from "ra-core";
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
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import {
  createChangeSuggestion,
  type ChangeSuggestion,
  type FeltSource,
} from "../changeSuggestions";

/**
 * Brief 46 §2 (16. sep 2026) · "Foreslå ændring" på et VISMA-ejet felt.
 *
 * Dialogen er tavs om form-validering — et telefonnummer kan skrives
 * på ti måder og kontoret læser det. Findes der allerede et afventende
 * forslag på samme felt, blokerer databasens partial unique index et
 * nyt insert; UI'et skjuler også knappen i det tilfælde og viser i
 * stedet det eksisterende forslag som en oplysningslinje (håndteres
 * af FieldRow, ikke her).
 */

interface ProposeChangeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  felt: string;
  feltSource: FeltSource;
  feltLabel: string;
  nuvaerendeVaerdi: string | null;
}

export function ProposeChangeDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  felt,
  feltSource,
  feltLabel,
  nuvaerendeVaerdi,
}: ProposeChangeDialogProps) {
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;
  const qc = useQueryClient();

  const [foreslaaetVaerdi, setForeslaaetVaerdi] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setForeslaaetVaerdi("");
    setNote("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createChangeSuggestion({
        companyId,
        felt,
        feltSource,
        nuvaerendeVaerdi,
        foreslaaetVaerdi: foreslaaetVaerdi.trim(),
        note: note.trim() || null,
        foreslaaetAf: mySalesId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["lago-change-suggestions-company", companyId],
      });
      qc.invalidateQueries({
        queryKey: ["lago-change-suggestions-open"],
      });
      toast.success(`Forslag sendt til kontoret`, {
        description: `${feltLabel} på ${companyName} — kontoret retter det i VISMA og forslaget lukker sig selv.`,
        duration: 6000,
      });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke sende forslag", {
        description: readErrorMessage(err),
      }),
  });

  // Brief 58 §5 (17. sep 2026): et forslag uden en ændring skal ikke
  // i køen. Kontoret holder op med at kigge i en kø, hvor rækker ikke
  // indeholder en ændring — sælgeren har måske villet bekræfte at
  // værdien er rigtig, men bekræftelses-knappen er en anden brief
  // (ROADMAP 2a-2). Indtil da: spær Gem, og sig hvorfor.
  const currentTrimmed = (nuvaerendeVaerdi ?? "").trim();
  const proposedTrimmed = foreslaaetVaerdi.trim();
  const isSameAsNow =
    proposedTrimmed.length > 0 && proposedTrimmed === currentTrimmed;
  const disabled =
    !proposedTrimmed || isSameAsNow || mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Foreslå ændring · {feltLabel}</DialogTitle>
          <DialogDescription className="sr-only">
            Send et forslag til kontoret om at rette et VISMA-ejet felt.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) mutation.mutate();
          }}
          className="flex flex-col"
        >
          <div className="space-y-4 px-6 pt-4 pb-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Står nu</Label>
              {/* Brief 85 token-runde (28. sep 2026): dialogen er en flade
                  som et kort; afsnittet ligger som indstik inde i den, derfor
                  --surface-1 (grå). Før stod den hvid på hvid — usynlig. */}
              <p className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
                {nuvaerendeVaerdi?.trim() || <em>Ikke sat</em>}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-value" className="text-sm">
                Skal være
              </Label>
              <Input
                id="ps-value"
                autoFocus
                value={foreslaaetVaerdi}
                onChange={(e) => setForeslaaetVaerdi(e.target.value)}
                className="min-h-11 w-full min-w-0 text-sm"
              />
              {isSameAsNow && (
                <p className="text-[13px] text-[var(--st-amber-fg)]">
                  Værdien er den samme som nu. Vil du rette noget andet?
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-note" className="text-sm">
                Hvorfor <span className="text-[var(--fg-3)]">(valgfri)</span>
              </Label>
              <Textarea
                id="ps-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm"
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
              disabled={disabled}
              className={cn(
                "min-w-[120px] gap-2",
                "bg-[var(--a-deep)] text-white hover:bg-[var(--a-deep)]/90",
              )}
            >
              {mutation.isPending && (
                <Icon icon={Loader2} className="animate-spin" />
              )}
              Send forslag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Blyant-knap der åbner ProposeChangeDialog. Diskret; --fg-3;
 *  synlig på hover/focus på bred skærm, altid på telefon (touch). */
interface ProposeChangeButtonProps {
  companyId: number;
  companyName: string;
  felt: string;
  feltSource: FeltSource;
  feltLabel: string;
  nuvaerendeVaerdi: string | null;
  /** Fra CoreInfoCard: skjul knappen når der allerede er et afventende
   *  forslag på samme felt — sælger #2 skal ikke oprette det samme. */
  disabled?: boolean;
}

export function ProposeChangeButton({
  companyId,
  companyName,
  felt,
  feltSource,
  feltLabel,
  nuvaerendeVaerdi,
  disabled = false,
}: ProposeChangeButtonProps) {
  const [open, setOpen] = useState(false);
  if (disabled) return null;
  return (
    <>
      {/* Brief 52 tillæg A §1 (17. sep 2026): blyanten er altid synlig
          — også på laptop. Før var den opacity-0 og krævede
          group-hover; kontoret arbejder på PC og aner ikke der er en
          knap før man hoverer. --fg-3 holder den dæmpet, men den er der. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Foreslå ændring til ${feltLabel}`}
        title="Foreslå ændring"
        className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-3)] hover:bg-[var(--surface-3)] hover:text-[var(--fg-2)] focus-visible:text-[var(--fg-2)]"
      >
        <Icon icon={Pencil} size="sm" />
      </button>
      <ProposeChangeDialog
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        companyName={companyName}
        felt={felt}
        feltSource={feltSource}
        feltLabel={feltLabel}
        nuvaerendeVaerdi={nuvaerendeVaerdi}
      />
    </>
  );
}
