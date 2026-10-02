import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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

import {
  closeOrdreKommentar,
  fetchAfventendeOrdreKommentarer,
  HENSIGT_LABEL,
  type OrdreKommentar,
} from "@/lago/customers/ordreKommentarer";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { Panel } from "@/lago/ui/Panel";
import { RowGroup } from "@/lago/ui/RowGroup";
import { StatusPill } from "@/lago/ui/StatusPill";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { OrdreDetaljeDialog } from "@/lago/customers/show/OrdreDetaljeDialog";
import { WidgetShell } from "../WidgetShell";

/**
 * Brief 89 · Kontorets ordrekommentar-liste (28. sep 2026).
 *
 * Alle afventende kommentarer på tværs af kunder. "Send nu" øverst — det
 * er dem der haster. To handlinger pr. række: Udført og Luk med begrundelse.
 *
 * Auto-luk (close_matched_ordre_kommentarer) fjerner selv rækkerne når
 * VISMA-importen viser at handlingen er sket — men koblingen på importen
 * er en åben post (dokumenteret i migration 89). Kontoret må lukke
 * manuelt indtil da.
 */

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatOprettet(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  return dateFmt.format(d);
}

const dateOnlyFmt = new Intl.DateTimeFormat("da-DK", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatAftaltDato(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateOnlyFmt.format(d);
}

export function OrdrekommentarerWidget() {
  const actorSalesId = useActorSalesId();
  const qc = useQueryClient();
  const [lukketDialog, setLukketDialog] = useState<OrdreKommentar | null>(null);
  const [lukketGrund, setLukketGrund] = useState("");
  const [lukketError, setLukketError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["lago-afventende-ordre-kommentarer"],
    queryFn: fetchAfventendeOrdreKommentarer,
    staleTime: 30_000,
  });

  const udfoert = useMutation({
    mutationFn: async (k: OrdreKommentar) => {
      await closeOrdreKommentar({
        id: k.id,
        status: "udfoert",
        lukketAf: actorSalesId,
        lukketGrund: null,
      });
      return k;
    },
    onSuccess: (k) => {
      qc.invalidateQueries({
        queryKey: ["lago-afventende-ordre-kommentarer"],
      });
      qc.invalidateQueries({
        queryKey: ["lago-ordre-kommentarer", k.companyId],
      });
      toast.success(
        `Markeret udført · ${k.companyName ?? "Kunde"} #${k.ordreNr}`,
      );
    },
    onError: (err) =>
      toast.error("Kunne ikke markere udført", {
        description: readErrorMessage(err),
      }),
  });

  const afvist = useMutation({
    mutationFn: async () => {
      if (!lukketDialog) throw new Error("Ingen kommentar valgt");
      if (!lukketGrund.trim()) throw new Error("Skriv en begrundelse");
      await closeOrdreKommentar({
        id: lukketDialog.id,
        status: "afvist",
        lukketAf: actorSalesId,
        lukketGrund: lukketGrund.trim(),
      });
      return lukketDialog;
    },
    onSuccess: (k) => {
      qc.invalidateQueries({
        queryKey: ["lago-afventende-ordre-kommentarer"],
      });
      qc.invalidateQueries({
        queryKey: ["lago-ordre-kommentarer", k.companyId],
      });
      toast.success(
        `Lukket med begrundelse · ${k.companyName ?? "Kunde"} #${k.ordreNr}`,
      );
      setLukketDialog(null);
      setLukketGrund("");
      setLukketError(null);
    },
    onError: (err) => setLukketError(readErrorMessage(err)),
  });

  const rows = query.data ?? [];
  const antal = rows.length;

  return (
    <WidgetShell
      title="Ordrekommentarer"
      subtitle="Sælgernes beskeder om åbne ordrer · Send nu øverst"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen afventende ordrekommentarer."
      count={
        antal > 0
          ? {
              label: `${antal} afventer`,
              tone: rows.some((r) => r.hensigt === "send_nu")
                ? "red"
                : "neutral",
            }
          : undefined
      }
      noPanel
    >
      {/* §98-1: fremhævet panel — border + kraftigere baggrund */}
      <Panel className="border-2 border-[var(--fg-3)]/20">
        <RowGroup>
          {rows.map((k) => {
            const isPending =
              (udfoert.isPending && udfoert.variables?.id === k.id) ||
              (afvist.isPending && lukketDialog?.id === k.id);
            // Brief 89 tillæg A (28. sep 2026): send_med_naeste_ordre er
            // ikke haster-hensigt, står neutral. Priority-sortering i
            // fetch-laget lægger den efter ring_kunde og leveringsdato.
            const tone =
              k.hensigt === "send_nu"
                ? "red"
                : k.hensigt === "ring_kunde"
                  ? "amber"
                  : "neutral";
            return (
              <li key={k.id}>
                <article className="flex flex-col gap-2 md:flex-row md:items-start md:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        to={`/companies/${k.companyId}/show`}
                        className="text-base font-bold text-[var(--fg)] no-underline hover:underline"
                      >
                        {k.companyName ?? `Kunde ${k.companyId}`}
                      </Link>
                      <OrdreNrLink ordreNr={k.ordreNr} />
                      <StatusPill variant={tone}>
                        {HENSIGT_LABEL[k.hensigt]}
                      </StatusPill>
                      {k.aftaltDato && (
                        <span className="text-[13px] font-medium text-[var(--fg-2)]">
                          {formatAftaltDato(k.aftaltDato)}
                        </span>
                      )}
                    </div>
                    {k.note && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg)]">
                        {k.note}
                      </p>
                    )}
                    <p className="mt-1 text-[12px] text-[var(--fg-3)]">
                      {k.oprettetAfNavn ?? "(ukendt)"} ·{" "}
                      {formatOprettet(k.oprettet)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => udfoert.mutate(k)}
                      disabled={isPending}
                      className="min-h-11 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
                    >
                      Udført
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLukketDialog(k)}
                      disabled={isPending}
                      className="min-h-11 bg-[var(--surface-3)] font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80"
                    >
                      Luk med begrundelse
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </RowGroup>
      </Panel>
      <Dialog
        open={lukketDialog != null}
        onOpenChange={(v) => {
          if (!v) {
            setLukketDialog(null);
            setLukketGrund("");
            setLukketError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Luk kommentar med begrundelse</DialogTitle>
            <DialogDescription>
              {lukketDialog?.companyName ?? "Kunde"} · Ordre #
              {lukketDialog?.ordreNr} —{" "}
              {lukketDialog && HENSIGT_LABEL[lukketDialog.hensigt]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ok-lukket" className="text-sm font-medium">
              Begrundelse
            </Label>
            <Textarea
              id="ok-lukket"
              rows={3}
              value={lukketGrund}
              onChange={(e) => setLukketGrund(e.target.value)}
              placeholder="Fx: kunden ringede selv, aftalen ændret."
              className="text-sm"
            />
            {lukketError && (
              <p className="text-sm text-[var(--st-red-fg)]">{lukketError}</p>
            )}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLukketDialog(null);
                setLukketGrund("");
                setLukketError(null);
              }}
              disabled={afvist.isPending}
            >
              Fortryd
            </Button>
            <Button
              type="button"
              onClick={() => afvist.mutate()}
              disabled={afvist.isPending || !lukketGrund.trim()}
              className="bg-[var(--st-red-fg)] text-white hover:bg-[var(--st-red-fg)]/90"
            >
              {afvist.isPending ? "Lukker …" : "Luk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WidgetShell>
  );
}

/** §98-2b: clickable order number → modal with order details */
function OrdreNrLink({ ordreNr }: { ordreNr: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-[var(--fg-3)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
      >
        · Ordre #{ordreNr}
      </button>
      <OrdreDetaljeDialog
        open={open}
        onOpenChange={setOpen}
        ordreNr={ordreNr}
      />
    </>
  );
}
