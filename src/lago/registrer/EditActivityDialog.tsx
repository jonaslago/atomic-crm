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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import { Loader2 } from "lucide-react";

import { AKTIVITET_TYPES, BESOEG_CODE } from "./types";
import { isPlannedDateIso, useUpdateActivity } from "./mutations";

// Brief 41 (16. sep 2026): redigering af aktiviteter i tidslinjen.
// Genbruger felterne fra Registrér-modalen — dato, type, note — men
// som en dedikeret dialog fordi validate + "hvad flytter kunden"-
// advarslen kun er relevant her. Ingen ny form-anatomi, kun ny titel
// og gem-tekst.
//
// Type-liste: BESØG (kode 1) er inkluderet her, hvor det ikke er i
// AKTIVITET_TYPES (som eksluderer besøg fordi det har egen fane i
// Registrér-modalen). Rettelse skal kunne flytte mellem besøg og andre
// typer, hvilket brief 41 §2b siger flytter kunden mellem lister.

const EDITABLE_TYPES: Array<{ code: number; label: string }> = [
  { code: BESOEG_CODE, label: "Besøg" },
  ...AKTIVITET_TYPES.map((t) => ({ code: t.code, label: t.label })),
];

interface EditActivityDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activity: {
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    description: string | null;
  };
  companyName?: string;
  /** Kundens seneste besøgsdato UDEN denne aktivitet — bruges til
   *  "hvad flytter kunden"-advarslen når typen skifter til/fra besøg.
   *  Null hvis der ikke findes andre besøg. */
  lastVisitWithoutThis: string | null;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateIso(value: string | null): string {
  if (!value) return todayIso();
  // activity_date kommer som "YYYY-MM-DD" eller ISO-timestamp — pluk date.
  if (value.length >= 10) return value.slice(0, 10);
  return value;
}

function formatDanish(iso: string | null): string {
  if (!iso) return "aldrig";
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function EditActivityDialog({
  open,
  onOpenChange,
  activity,
  companyName,
  lastVisitWithoutThis,
}: EditActivityDialogProps) {
  const translate = useTranslate();
  const mutation = useUpdateActivity();

  const [note, setNote] = useState(activity.description ?? "");
  const [dateIso, setDateIso] = useState(toDateIso(activity.activity_date));
  const [typeCode, setTypeCode] = useState<number>(
    activity.activity_type_code ?? BESOEG_CODE,
  );
  const [error, setError] = useState<string | null>(null);

  // Nulstil felter når dialogen åbnes eller aktiviteten skifter.
  useEffect(() => {
    if (!open) return;
    setNote(activity.description ?? "");
    setDateIso(toDateIso(activity.activity_date));
    setTypeCode(activity.activity_type_code ?? BESOEG_CODE);
    setError(null);
  }, [open, activity]);

  const originalType = activity.activity_type_code ?? null;
  const isBecomingVisit = originalType !== BESOEG_CODE && typeCode === BESOEG_CODE;
  const isLosingVisit = originalType === BESOEG_CODE && typeCode !== BESOEG_CODE;
  const isBesoegType = typeCode === BESOEG_CODE;

  // Brief 41 §2b: fortæl konsekvensen før der gemmes.
  const consequenceMessage = useMemo(() => {
    if (isBecomingVisit && !isPlannedDateIso(dateIso)) {
      return `Kunden regnes herefter som besøgt ${formatDanish(dateIso)}.`;
    }
    if (isLosingVisit) {
      if (lastVisitWithoutThis) {
        return `Kunden regnes herefter som senest besøgt ${formatDanish(
          lastVisitWithoutThis,
        )}.`;
      }
      return "Kunden har herefter ingen registrerede besøg.";
    }
    return null;
  }, [isBecomingVisit, isLosingVisit, dateIso, lastVisitWithoutThis]);

  const handleSubmit = () => {
    setError(null);
    // Brief 41 §3: fremtidsdato afvises på besøg — prøvet mod den type,
    // rettelsen giver, ikke den rækken havde.
    if (isBesoegType && isPlannedDateIso(dateIso)) {
      setError(
        "Et besøg planlægges med Planlæg besøg — så ryger det i Dagens.",
      );
      return;
    }
    // Send kun de felter der reelt har ændret sig — null bevarer
    // eksisterende værdi i RPC'en.
    const noteChanged = note.trim() !== (activity.description ?? "").trim();
    const dateChanged = dateIso !== toDateIso(activity.activity_date);
    const typeChanged = typeCode !== (activity.activity_type_code ?? BESOEG_CODE);
    if (!noteChanged && !dateChanged && !typeChanged) {
      onOpenChange(false);
      return;
    }
    mutation.mutate(
      {
        activityId: activity.id,
        companyId: activity.company_id,
        companyName,
        newNote: noteChanged ? note.trim() : null,
        newDate: dateChanged ? dateIso : null,
        newTypeCode: typeChanged ? typeCode : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Ret aktivitet</DialogTitle>
          <DialogDescription className="sr-only">
            Ret notetekst, dato eller type på en registreret aktivitet.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col"
        >
          <div className="space-y-4 px-6 pt-4 pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="edit-type" className="text-sm">
                  Type
                </Label>
                <Select
                  value={String(typeCode)}
                  onValueChange={(v) => setTypeCode(Number(v))}
                >
                  <SelectTrigger
                    id="edit-type"
                    className="min-h-11 w-full min-w-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITABLE_TYPES.map((t) => (
                      <SelectItem key={t.code} value={String(t.code)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="edit-date" className="text-sm">
                  Dato
                </Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={dateIso}
                  onChange={(e) => setDateIso(e.target.value)}
                  className="min-h-11 w-full min-w-0"
                />
              </div>
            </div>
            {/* Brief 41 §2b: konsekvensen skal siges FØR der gemmes.
                Ellers ser sælgeren en kunde flytte sig uden at vide
                hvorfor. Vises kun når typen faktisk ændrer besøgs-
                status. */}
            {consequenceMessage && (
              <p className="rounded-md border border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)] p-3 text-sm text-[var(--fg)]">
                {consequenceMessage}
              </p>
            )}
            {/* Fremtidig dato på ikke-besøg = planlagt (brief 35 §1). */}
            {!isBesoegType && isPlannedDateIso(dateIso) && (
              <p className="text-[13px] text-[var(--fg-2)]">
                Registreres som planlagt — ikke afholdt endnu
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-note" className="text-sm font-bold">
                Note
              </Label>
              <Textarea
                id="edit-note"
                rows={5}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm"
              />
            </div>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
            >
              {translate("lago.registrer.cancel", { _: "Annullér" })}
            </button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                "min-w-[120px] gap-2",
                "bg-[var(--a-deep)] text-white hover:bg-[var(--a-deep)]/90 focus-visible:ring-[var(--a)]/40",
              )}
            >
              {mutation.isPending && (
                <Icon icon={Loader2} className="animate-spin" />
              )}
              Gem rettelse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
