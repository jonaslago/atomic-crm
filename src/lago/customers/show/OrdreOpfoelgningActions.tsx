import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Clock, Loader2, RefreshCw } from "lucide-react";

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

import { Icon } from "@/lago/ui/Icon";
import { Button as LagoButton } from "@/lago/ui/Button";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { useAssignableUsers } from "@/lago/registrer/useAssignableUsers";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import {
  sendTilSaelger,
  markerAfventerVisma,
  udskydOpfoelgning,
} from "./ordreOpfoelgning";

/**
 * §99-5 (2. okt 2026): three office actions on an open order.
 *
 * Only visible to kontor/admin role. Rendered inside the expanded
 * order row on the customer card.
 */

function inOneWeekIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface OrdreActionsProps {
  ordreNr: string;
  companyId: number;
  companyName: string;
  /** A contact on this customer (for the task created by "send to salesperson") */
  contactId: number | null;
}

export function OrdreOpfoelgningActions({
  ordreNr,
  companyId,
  companyName,
  contactId,
}: OrdreActionsProps) {
  const actorSalesId = useActorSalesId();
  const qc = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);
  const [udskydOpen, setUdskydOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lago-ordre-opfoelgninger", companyId] });
    qc.invalidateQueries({ queryKey: ["lago-customer"] });
  };

  // "Ny status sat i VISMA"
  const vismaMutation = useMutation({
    mutationFn: () =>
      markerAfventerVisma({
        ordreNr,
        companyId,
        oprettetAf: actorSalesId!,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Afventer bekræftelse fra VISMA-import.");
    },
    onError: (err) =>
      toast.error("Kunne ikke markere", {
        description: readErrorMessage(err),
      }),
  });

  if (!actorSalesId) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <LagoButton variant="secondary" onClick={() => setSendOpen(true)}>
        <Icon icon={ArrowUpRight} size="sm" />
        Send til sælger
      </LagoButton>
      <LagoButton
        variant="secondary"
        onClick={() => vismaMutation.mutate()}
        disabled={vismaMutation.isPending}
      >
        {vismaMutation.isPending ? (
          <Icon icon={Loader2} size="sm" className="animate-spin" />
        ) : (
          <Icon icon={RefreshCw} size="sm" />
        )}
        Ny status i VISMA
      </LagoButton>
      <LagoButton variant="secondary" onClick={() => setUdskydOpen(true)}>
        <Icon icon={Clock} size="sm" />
        Udskyd
      </LagoButton>

      <SendTilSaelgerDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        ordreNr={ordreNr}
        companyId={companyId}
        companyName={companyName}
        contactId={contactId}
        oprettetAf={actorSalesId}
        onDone={invalidate}
      />
      <UdskydDialog
        open={udskydOpen}
        onOpenChange={setUdskydOpen}
        ordreNr={ordreNr}
        companyId={companyId}
        oprettetAf={actorSalesId}
        onDone={invalidate}
      />
    </div>
  );
}

// --- Send til sælger dialog ---

function SendTilSaelgerDialog({
  open,
  onOpenChange,
  ordreNr,
  companyId,
  companyName,
  contactId,
  oprettetAf,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ordreNr: string;
  companyId: number;
  companyName: string;
  contactId: number | null;
  oprettetAf: number;
  onDone: () => void;
}) {
  const { options } = useAssignableUsers({ includeBackoffice: false });
  const [selectedSeller, setSelectedSeller] = useState("");
  const [frist, setFrist] = useState(inOneWeekIso());
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedSeller || !contactId) throw new Error("Vælg sælger");
      return sendTilSaelger({
        ordreNr,
        companyId,
        oprettetAf,
        sendtTil: Number(selectedSeller),
        frist,
        note: note.trim() || null,
        contactId,
        taskText: `Opfølgning: ordre #${ordreNr} på ${companyName}${note.trim() ? ` — ${note.trim()}` : ""}`,
      });
    },
    onSuccess: () => {
      toast.success("Sendt til sælger for opfølgning.");
      onOpenChange(false);
      onDone();
    },
    onError: (err) =>
      toast.error("Kunne ikke sende", {
        description: readErrorMessage(err),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send til sælger</DialogTitle>
          <DialogDescription>
            Ordre #{ordreNr} — sælgeren får en opgave med frist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Sælger</Label>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Vælg sælger" />
              </SelectTrigger>
              <SelectContent>
                {options
                  .filter((o) => o.hasLogin && o.kind !== "backoffice")
                  .map((o) => (
                    <SelectItem key={o.key} value={String(o.salesId ?? "")}>
                      {o.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Frist</Label>
            <Input
              type="date"
              value={frist}
              onChange={(e) => setFrist(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Note (valgfri)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fx: Ring kunden og aftal levering"
              className="text-sm"
            />
          </div>
          {!contactId && (
            <p className="text-sm text-[var(--st-amber-fg)]">
              Kunden har ingen kontaktperson — opgaven kan ikke oprettes.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selectedSeller || !contactId || mutation.isPending}
          >
            {mutation.isPending && (
              <Icon icon={Loader2} className="animate-spin" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Udskyd dialog ---

function UdskydDialog({
  open,
  onOpenChange,
  ordreNr,
  companyId,
  oprettetAf,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ordreNr: string;
  companyId: number;
  oprettetAf: number;
  onDone: () => void;
}) {
  const [frist, setFrist] = useState(inOneWeekIso());
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      udskydOpfoelgning({
        ordreNr,
        companyId,
        oprettetAf,
        frist,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`Udskudt til ${frist}.`);
      onOpenChange(false);
      onDone();
    },
    onError: (err) =>
      toast.error("Kunne ikke udskyde", {
        description: readErrorMessage(err),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Udskyd opfølgning</DialogTitle>
          <DialogDescription>
            Ordre #{ordreNr} — vælg ny frist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Ny frist</Label>
            <Input
              type="date"
              value={frist}
              onChange={(e) => setFrist(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Begrundelse (valgfri)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fx: Afventer svar fra leverandør"
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!frist || mutation.isPending}
          >
            {mutation.isPending && (
              <Icon icon={Loader2} className="animate-spin" />
            )}
            Udskyd
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
