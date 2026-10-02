import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

import { Icon } from "@/lago/ui/Icon";
import { createChangeSuggestion } from "./changeSuggestions";
import { readErrorMessage } from "@/lago/ui/errorMessage";

/**
 * §93 (2. okt 2026): "Foreslå: kunden er ophørt".
 *
 * One component, two entry points: customer card and visit registration.
 * Creates a change suggestion with felt='status', foreslaaet_vaerdi='ophørt'.
 *
 * Begrundelse is required, minimum 10 characters. A dropdown would make
 * the salesperson choose the nearest option instead of writing what they saw.
 */

interface SuggestCeasedDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  actorSalesId: number | null;
}

const MIN_CHARS = 10;

export function SuggestCeasedDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  actorSalesId,
}: SuggestCeasedDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      return createChangeSuggestion({
        companyId,
        felt: "status",
        feltSource: "companies_lago",
        nuvaerendeVaerdi: "aktiv",
        foreslaaetVaerdi: "ophørt",
        note: note.trim(),
        foreslaaetAf: actorSalesId,
      });
    },
    onSuccess: () => {
      toast.success(`Forslag sendt: ${companyName} foreslået ophørt`);
      qc.invalidateQueries({ queryKey: ["lago-forslag-rettelser"] });
      setNote("");
      setError(null);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke sende forslaget", {
        description: readErrorMessage(err),
      }),
  });

  const submit = () => {
    setError(null);
    const trimmed = note.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(`Begrundelse skal være mindst ${MIN_CHARS} tegn.`);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Foreslå: kunden er ophørt</DialogTitle>
          <DialogDescription>
            {companyName} — forslaget sendes til kontoret, som vurderer det.
            Kunden ændres ikke, før VISMA siger andet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ceased-note" className="text-sm font-bold">
              Hvad har du observeret?
            </Label>
            <Textarea
              id="ceased-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fx: Butikken var lukket og tømt, skiltet er taget ned."
              className="text-sm"
            />
            <p className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
              Mindst {MIN_CHARS} tegn. Kontoret bruger din begrundelse til at
              afgøre, om status skal ændres i VISMA.
            </p>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && (
              <Icon icon={Loader2} className="animate-spin" />
            )}
            Send forslag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
