import { CalendarClock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

/**
 * Brief 76 tillæg A (23. sep 2026) · FS-20 for opgaver.
 *
 * Udskyd på MineOpgaverWidget er en RIGTIG due_date-flytning — ikke
 * bare en note-tilføjelse på tasks.text som send-videre gør. To
 * mutations i én transaktion (Supabase har ikke transaktions-SDK, så
 * vi kører dem sekventielt og roller tilbage manuelt hvis event-insert
 * fejler efter update):
 *
 *   1. UPDATE tasks SET due_date = ny_dato
 *   2. INSERT INTO task_events_lago (task_id, event_type='udskudt',
 *      event_af=auth.uid(), note=begrundelse,
 *      udskudt_fra_dato=gamle, udskudt_til_dato=ny)
 *
 * Begrundelsen lander IKKE i tasks.text — det er præcis den skrøbelighed
 * send-videre-funktionen har (ILIKE-match på fritekst der kan redigeres
 * bort). Event-log er den langsigtede løsning; send-videre migreres i
 * en separat runde.
 */

interface UdskudTaskDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: number;
  taskLabel: string;
  currentDueDate: string | null;
  onDone?: () => void;
}

function toLocalDateIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function useUdskydTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: number;
      nyDato: string;
      begrundelse: string | null;
      gammelDato: string | null;
    }) => {
      const supabase = getSupabaseClient();
      // Hent auth.uid() klientside — RLS-policy'en på task_events_lago
      // kræver event_af = auth.uid() (uuid), ikke sales_id (bigint).
      const { data: sessionData } = await supabase.auth.getSession();
      const eventAf = sessionData.session?.user?.id;
      if (!eventAf) {
        throw new Error("Ingen aktiv session — log ud og ind igen.");
      }
      const { error: updErr } = await supabase
        .from("tasks")
        .update({ due_date: input.nyDato })
        .eq("id", input.taskId);
      if (updErr) throw updErr;
      const { error: evErr } = await supabase.from("task_events_lago").insert({
        task_id: input.taskId,
        event_type: "udskudt",
        event_af: eventAf,
        note: input.begrundelse,
        udskudt_fra_dato: input.gammelDato,
        udskudt_til_dato: input.nyDato,
      });
      if (evErr) {
        // Rul tilbage — men accepter at rollback også kan fejle
        // (så er data i inkonsistent tilstand: due_date rykket uden
        // spor i event-log). Rapporteres til brugeren så hun kan
        // beslutte at prøve igen eller redigere manuelt.
        await supabase
          .from("tasks")
          .update({ due_date: input.gammelDato })
          .eq("id", input.taskId);
        throw evErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mine-opgaver"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function UdskudTaskDialog({
  open,
  onOpenChange,
  taskId,
  taskLabel,
  currentDueDate,
  onDone,
}: UdskudTaskDialogProps) {
  const mutation = useUdskydTask();
  const [date, setDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const iMorgen = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDateIso(d);
  };
  const omEnUge = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalDateIso(d);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNote("");
    // Forslag: én uge frem. Sælger kan ændre frit via knappen "I morgen"
    // eller ved at klikke direkte i dato-feltet.
    setDate(omEnUge());
  }, [open]);

  const submit = () => {
    setError(null);
    if (!date) {
      setError("Ny dato skal vælges.");
      return;
    }
    // Brief 76 tillæg A opfølgning (23. sep 2026): begrundelse er
    // VALGFRI. Ellers skriver folk "x" for at komme igennem, og feltet
    // bliver værdiløst. Tomt = null i event-log.
    const gammelDato = currentDueDate ? currentDueDate.substring(0, 10) : null;
    mutation.mutate(
      {
        taskId,
        nyDato: date,
        begrundelse: note.trim() || null,
        gammelDato,
      },
      {
        onSuccess: () => {
          toast.success("Opgave udskudt");
          onOpenChange(false);
          onDone?.();
        },
        onError: (e) => {
          setError(readErrorMessage(e) ?? "Kunne ikke udskyde opgaven.");
        },
      },
    );
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    // Nogle browsere (Safari mobil) understøtter showPicker(); ellers
    // fallback til focus + click.
    const anyEl = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof anyEl.showPicker === "function") {
      try {
        anyEl.showPicker();
        return;
      } catch {
        // showPicker() kan kaste hvis input ikke er visible/enabled;
        // fald igennem til focus.
      }
    }
    el.focus();
    el.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={CalendarClock} className="text-[var(--ink)]" />
            Udskyd opgave
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {taskLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="udskyd-date" className="text-sm">
              Ny dato
            </Label>
            {/* Brief 76 tillæg A opfølgning (23. sep 2026): tre genveje
                i en række, min-h-11 så de kan rammes på 390 px. De to
                første prefyller feltet; "Vælg dato" åbner date-picker
                programmatisk (fallback: focus + click). Input'et står
                nedenfor så sælgeren altid kan se den valgte dato. */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={date === iMorgen() ? "default" : "outline"}
                size="sm"
                onClick={() => setDate(iMorgen())}
                className="min-h-11"
              >
                I morgen
              </Button>
              <Button
                type="button"
                variant={date === omEnUge() ? "default" : "outline"}
                size="sm"
                onClick={() => setDate(omEnUge())}
                className="min-h-11"
              >
                Om en uge
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openDatePicker}
                className="min-h-11"
              >
                Vælg dato
              </Button>
            </div>
            <Input
              id="udskyd-date"
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="udskyd-note" className="text-sm">
              Begrundelse{" "}
              <span className="text-[var(--fg-3)] font-normal">(valgfrit)</span>
            </Label>
            <Textarea
              id="udskyd-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fx: Kunden er på ferie, vender tilbage om ti dage"
              className="text-sm"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Annullér
          </Button>
          <Button size="sm" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Udskyder …" : "Udskyd"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
