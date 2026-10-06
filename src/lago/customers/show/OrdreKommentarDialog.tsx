import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { OrdreOpfoelgningActions } from "./OrdreOpfoelgningActions";
import {
  createOrdreKommentarer,
  HENSIGT_HINT,
  HENSIGT_LABEL,
  type OrdreKommentarHensigt,
} from "../ordreKommentarer";

/**
 * Brief 89 · Ordrekommentar-dialog (28. sep 2026).
 *
 * Genbrugelig — samme dialog fra kundekortets åbne ordrer og fra
 * besøgs-tjeklistens "Afklar åbne ordrer" (FS-23, kommer senere).
 * Logikken bor her, ikke i kundekortet — ellers fører tjeklistens
 * første punkt ingen steder hen, når den bygges.
 *
 * Fem hensigter (§2 · ikke flere, så bliver det en formular). Datofelt
 * er kun synligt ved "Leveringsdato aftalt" og er påkrævet i den grene.
 * Ved flervalg oprettes én række pr. ordre_nr — så de kan lukkes hver
 * for sig efterhånden som kontoret ekspederer.
 *
 * `oprettet_af` = actorSalesId — under dækning er det den handlende
 * (Jonas), ikke den passede (Camilla). Brief 84 §1's mønster.
 */

interface OrdreKommentarDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  ordreNumre: string[];
  onSaved?: () => void;
  /** §38d: pre-select a hensigt when the dialog opens. */
  defaultHensigt?: OrdreKommentarHensigt | null;
  /** §99: contact for task creation in "Send til sælger" */
  contactId?: number | null;
}

// Brief 89 tillæg A (28. sep 2026): seks hensigter. Rækkefølge er
// prioriteret — hurtigst-handling øverst, "Andet" nederst som fald-
// tilbage. Seks er grænsen; flere gør det til en formular.
const HENSIGT_ORDER: OrdreKommentarHensigt[] = [
  "send_nu",
  "send_med_naeste_ordre",
  "leveringsdato",
  "ring_kunde",
  "afvent",
  "andet",
];

export function OrdreKommentarDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  ordreNumre,
  onSaved,
  defaultHensigt,
  contactId = null,
}: OrdreKommentarDialogProps) {
  const actorSalesId = useActorSalesId();
  const { role } = useCurrentLagoRole();
  const isKontor = role === "kontor" || role === "admin";
  const qc = useQueryClient();
  const [hensigt, setHensigt] = useState<OrdreKommentarHensigt | null>(null);
  const [aftaltDato, setAftaltDato] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Reset ved åbning — use defaultHensigt if provided (§38d).
  useEffect(() => {
    if (open) {
      setHensigt(defaultHensigt ?? null);
      setAftaltDato("");
      setNote("");
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!hensigt) throw new Error("Vælg en hensigt");
      if (hensigt === "leveringsdato" && !aftaltDato) {
        throw new Error(
          "Leveringsdato kræver en dato — det er hele pointen med hensigten",
        );
      }
      return createOrdreKommentarer({
        companyId,
        ordreNumre,
        hensigt,
        aftaltDato: hensigt === "leveringsdato" ? aftaltDato : null,
        note: note.trim() || null,
        oprettetAf: actorSalesId,
      });
    },
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["lago-ordre-kommentarer", companyId] });
      qc.invalidateQueries({ queryKey: ["lago-afventende-ordre-kommentarer"] });
      const antalOrdrer = rows.length;
      toast.success(
        antalOrdrer === 1
          ? `Kommentar tilføjet på ordre #${rows[0].ordreNr}`
          : `Kommentar tilføjet på ${antalOrdrer} ordrer`,
        { description: `${HENSIGT_LABEL[rows[0].hensigt]} · ${companyName}` },
      );
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      setError(readErrorMessage(err));
    },
  });

  const submit = () => {
    setError(null);
    mutation.mutate();
  };

  const showDato = hensigt === "leveringsdato";
  const antal = ordreNumre.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {antal === 1
              ? `Opfølgning — ordre #${ordreNumre[0]}`
              : `Opfølgning — ${antal} ordrer`}
          </DialogTitle>
          <DialogDescription>
            {companyName} · Kontoret læser opfølgningen og handler i VISMA. Én
            opfølgning pr. ordre, så de kan lukkes hver for sig.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Hensigt</Label>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {HENSIGT_ORDER.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHensigt(h)}
                  className={cn(
                    "flex min-h-11 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                    hensigt === h
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-1)]",
                  )}
                >
                  <span className="text-sm font-medium">
                    {HENSIGT_LABEL[h]}
                  </span>
                  <span
                    className={cn(
                      "text-[12px]",
                      hensigt === h ? "text-white/80" : "text-[var(--fg-3)]",
                    )}
                  >
                    {HENSIGT_HINT[h]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {showDato && (
            <div className="space-y-1.5">
              <Label htmlFor="ok-dato" className="text-sm font-medium">
                Aftalt leveringsdato
              </Label>
              <Input
                id="ok-dato"
                type="date"
                value={aftaltDato}
                onChange={(e) => setAftaltDato(e.target.value)}
                className="min-h-11"
              />
              <p className="text-[12px] text-[var(--fg-3)]">
                Kontoret sætter datoen på ordren i VISMA (Ønsket lev. Dato) og
                leverer på den.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ok-note" className="text-sm font-medium">
              Note{" "}
              {hensigt === "andet" && (
                <span className="text-[var(--fg-3)]">· (påkrævet)</span>
              )}
            </Label>
            <Textarea
              id="ok-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                hensigt === "andet"
                  ? "Beskriv hvad kontoret skal gøre."
                  : "Fx: kunden vil have Barolo'en først, resten kan vente."
              }
              className="text-sm"
            />
          </div>

          {/* §99-5: office actions — only kontor/admin, only single order */}
          {isKontor && antal === 1 && (
            <div className="border-t border-[var(--line)] pt-3">
              <p className="mb-2 text-[13px] font-medium text-[var(--fg-2)]">
                Kontorets handlinger
              </p>
              <OrdreOpfoelgningActions
                ordreNr={ordreNumre[0]}
                companyId={companyId}
                companyName={companyName}
                contactId={contactId}
              />
            </div>
          )}

          {error && <p className="text-sm text-[var(--st-red-fg)]">{error}</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Fortryd
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={
              mutation.isPending ||
              !hensigt ||
              (hensigt === "leveringsdato" && !aftaltDato) ||
              (hensigt === "andet" && !note.trim())
            }
            className="bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
          >
            {mutation.isPending ? "Gemmer …" : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
