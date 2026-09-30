import { CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslate } from "ra-core";

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

import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";

import { usePlanNextVisit } from "./mutations";

interface PlanVisitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName: string;
  /**
   * Auto-forslag baseret på segment. A/B/C giver "i dag + interval". X/L
   * eller ukendt segment giver tom dato (bevidst puf til klassificering).
   */
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  /** Prefill hvis kunden allerede har en planlagt aftale (redigering). */
  currentPlannedIso?: string | null;
  currentNote?: string | null;
  /** Kaldes efter succesfuld skrivning; typisk til at lukke parent-flow. */
  onSaved?: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeIso(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Brief 15 · FS-20: eneste skrive-flade for `next_visit_planned`. Genbruges
 * fra kundekortet ("Planlæg besøg") og som step-2 efter et registreret
 * besøg ("Planlæg næste besøg"). Auto-forslag baseret på segment-interval
 * fylder datoen ved åbning — sælger kan ændre frit.
 */
export function PlanVisitDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  segment,
  currentPlannedIso,
  currentNote,
  onSaved,
}: PlanVisitDialogProps) {
  const translate = useTranslate();
  const intervals = useVisitIntervals();
  const mutation = usePlanNextVisit();
  // Brief 84 §4 (28. sep 2026): planen tildeles kundens ansvarlige
  // sælger som standard. Under dækning: viewSalesId=Camilla (det er
  // hendes kunde og hendes at køre derud til). Ellers: actor.
  // Sælger-vælger til at overskrive er tillæg §5's separate runde —
  // bygges ikke her, men defaulten er allerede rigtig.
  const myPlannedBySalesId = useViewSalesId();

  const suggestion = useMemo(() => {
    if (segment === "A" || segment === "B" || segment === "C") {
      const days = intervals?.intervalDays?.[segment];
      if (typeof days === "number" && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return toLocalDateIso(d);
      }
    }
    return "";
  }, [segment, intervals]);

  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Reset fields whenever the dialog reopens — prefer current booking
  // if it exists, else fall back to the segment-based suggestion.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (currentPlannedIso) {
      const d = new Date(currentPlannedIso);
      if (!Number.isNaN(d.getTime())) {
        setDate(toLocalDateIso(d));
        // Skjul 00:00 (tom tid ved oprettelse); vis alt andet.
        const hm = toLocalTimeIso(d);
        setTime(hm === "00:00" ? "" : hm);
      }
    } else {
      setDate(suggestion);
      setTime("");
    }
    setNote(currentNote ?? "");
  }, [open, currentPlannedIso, currentNote, suggestion]);

  const submit = () => {
    setError(null);
    if (!date) {
      setError(translate("lago.plan_visit.date_required"));
      return;
    }
    mutation.mutate(
      {
        companyId,
        companyName,
        dateIso: date,
        timeHm: time || null,
        note: note.trim() || null,
        plannedBySalesId: myPlannedBySalesId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved?.();
        },
      },
    );
  };

  const clear = () => {
    setError(null);
    mutation.mutate(
      { companyId, companyName, dateIso: null },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved?.();
        },
      },
    );
  };

  const hasExisting = !!currentPlannedIso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={CalendarClock} className="text-[var(--ink)]" />
            {translate(
              hasExisting
                ? "lago.plan_visit.title_edit"
                : "lago.plan_visit.title_new",
              { name: companyName },
            )}
          </DialogTitle>
          <DialogDescription>
            {translate("lago.plan_visit.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-date" className="text-sm">
                {translate("lago.plan_visit.date_label")}
              </Label>
              <Input
                id="plan-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                autoFocus
              />
              {suggestion && date === suggestion && !hasExisting && (
                <p className="text-muted-foreground text-sm">
                  {translate("lago.plan_visit.suggestion_hint", {
                    segment: segment ?? "?",
                  })}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-time" className="text-sm">
                {translate("lago.plan_visit.time_label")}
              </Label>
              <Input
                id="plan-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-note" className="text-sm">
              {translate("lago.plan_visit.note_label")}
            </Label>
            <Textarea
              id="plan-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={translate("lago.plan_visit.note_placeholder")}
              className="text-sm"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="mt-2 flex-row justify-between gap-2 sm:justify-between">
          {hasExisting ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={mutation.isPending}
              className="text-destructive"
            >
              {translate("lago.plan_visit.clear")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {translate("lago.plan_visit.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={mutation.isPending}
            >
              {translate("lago.plan_visit.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
