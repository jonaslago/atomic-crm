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

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";

/**
 * Brief 46 §2 (16. sep 2026) · Detaljer-dialog for CRM-ejede felter.
 *
 * Modsat "Kerne-info" (adresse, telefon, betaling — VISMA-ejet, kun
 * forslag) er detaljer noget CRM'et selv ejer: åbningstider,
 * branche, noter. Sælger og kontor må redigere dem direkte uden at
 * gå igennem forslags-loopet.
 *
 * Sparsomt formet: to felter i companies (sector, description) og et
 * felt i companies_lago (opening_hours). Vi opdaterer kun tabellerne
 * der reelt fik ændringer for at holde updated_at rent.
 */

interface DetaljerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  initial: {
    sector: string | null;
    opening_hours: string | null;
    description: string | null;
  };
}

interface FormState {
  sector: string;
  opening_hours: string;
  description: string;
}

function toForm(initial: DetaljerDialogProps["initial"]): FormState {
  return {
    sector: initial.sector ?? "",
    opening_hours: initial.opening_hours ?? "",
    description: initial.description ?? "",
  };
}

export function DetaljerDialog({
  open,
  onOpenChange,
  companyId,
  initial,
}: DetaljerDialogProps) {
  const invalidate = useInvalidateAfterWrite();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(initial));

  useEffect(() => {
    if (open) setForm(toForm(initial));
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      const nextSector = form.sector.trim() || null;
      const nextHours = form.opening_hours.trim() || null;
      const nextDesc = form.description.trim() || null;

      const companiesChanged =
        nextSector !== (initial.sector ?? null) ||
        nextDesc !== (initial.description ?? null);
      const extensionChanged = nextHours !== (initial.opening_hours ?? null);

      if (companiesChanged) {
        const { error } = await supabase
          .from("companies")
          .update({ sector: nextSector, description: nextDesc })
          .eq("id", companyId);
        if (error) throw error;
      }
      if (extensionChanged) {
        const { error } = await supabase
          .from("companies_lago")
          .upsert(
            {
              company_id: companyId,
              opening_hours: nextHours,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "company_id" },
          );
        if (error) throw error;
      }
      return { companiesChanged, extensionChanged };
    },
    onSuccess: (result) => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
      if (result.companiesChanged || result.extensionChanged) {
        toast.success("Detaljer opdateret");
      } else {
        toast("Ingen ændringer");
      }
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme detaljer", {
        description: readErrorMessage(err),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Redigér detaljer</DialogTitle>
          <DialogDescription className="sr-only">
            CRM-ejede felter — retter direkte uden godkendelse fra kontoret.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!save.isPending) save.mutate();
          }}
          className="flex flex-col"
        >
          <div className="space-y-4 px-6 pt-3 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="d-hours" className="text-sm">
                Åbningstider
              </Label>
              <Input
                id="d-hours"
                autoFocus
                value={form.opening_hours}
                onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
                placeholder="fx: Man-fre 09-17, lør 10-14"
                className="min-h-11 w-full min-w-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-sector" className="text-sm">
                Branche
              </Label>
              <Input
                id="d-sector"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="fx: Restaurant · fine dining"
                className="min-h-11 w-full min-w-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-notes" className="text-sm">
                Noter
              </Label>
              <Textarea
                id="d-notes"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Fri tekst — bruges af sælger og kontor. Ikke synligt for kunden."
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
              disabled={save.isPending}
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
