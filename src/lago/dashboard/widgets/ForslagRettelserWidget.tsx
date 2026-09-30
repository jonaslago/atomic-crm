import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
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
import { cn } from "@/lib/utils";

import { readErrorMessage } from "@/lago/ui/errorMessage";
import { fieldLabel, formatFieldValue } from "@/lago/customers/fieldLabels";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import {
  fetchOpenSuggestions,
  markSuggestionDone,
  rejectSuggestion,
  type ChangeSuggestion,
} from "@/lago/customers/changeSuggestions";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";

/**
 * Brief 46 §3 (16. sep 2026): kontorets kø over foreslåede rettelser.
 *
 * Primær handling er "Markér rettet" — for de gange hvor
 * close_matched_change_suggestions ikke fanger det (fx hvis kontoret
 * retter feltet anderledes end foreslået). Afvis kræver en grund;
 * grunden vises for sælgeren.
 *
 * Rækker over 30 dage vises dæmpet — ikke skjult. En kø der kun vokser,
 * holder folk op med at kigge i (§1).
 */

const STALE_AFTER_DAYS = 30;

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

function shortDateFmt(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function ForslagRettelserWidget() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Brief 84 §1 (28. sep 2026): lukketAf/afvistAf er ren aktør —
  // widget'en filtrerer ikke på nogen sales_id (viser alle åbne
  // forslag), så viewSalesId er ikke i spil. Under dækning står
  // stadig Simons navn på lukningen, ikke Camillas.
  const mySalesId = useActorSalesId();
  const query = useQuery({
    queryKey: ["lago-change-suggestions-open"],
    queryFn: fetchOpenSuggestions,
    staleTime: 60_000,
  });

  const [rejectTarget, setRejectTarget] = useState<ChangeSuggestion | null>(
    null,
  );

  const markDone = useMutation({
    mutationFn: (id: number) =>
      markSuggestionDone({ id, lukketAf: mySalesId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-change-suggestions-open"] });
      toast.success("Forslag markeret som rettet");
    },
    onError: (err) =>
      toast.error("Kunne ikke markere rettet", {
        description: readErrorMessage(err),
      }),
  });

  const rows = query.data ?? [];
  const totalCount = rows.length;

  return (
    <WidgetShell
      title="Foreslåede rettelser"
      subtitle="Sælgernes forslag til kunde-data — retter du i VISMA, lukker forslaget sig selv"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      count={
        totalCount > 0
          ? { label: `${totalCount} afventer`, tone: "amber" }
          : undefined
      }
      emptyState="Ingen forslag lige nu."
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const stale = daysSince(r.oprettet) >= STALE_AFTER_DAYS;
          return (
            <li key={r.id}>
              <SuggestionRow
                suggestion={r}
                stale={stale}
                onMarkDone={() => markDone.mutate(r.id)}
                onReject={() => setRejectTarget(r)}
                onOpen={() => navigate(`/companies/${r.companyId}/show`)}
                disabled={markDone.isPending}
              />
            </li>
          );
        })}
      </ul>
      {rejectTarget && (
        <RejectDialog
          suggestion={rejectTarget}
          onClose={() => setRejectTarget(null)}
          mySalesId={mySalesId}
        />
      )}
    </WidgetShell>
  );
}

function SuggestionRow({
  suggestion,
  stale,
  onMarkDone,
  onReject,
  onOpen,
  disabled,
}: {
  suggestion: ChangeSuggestion;
  stale: boolean;
  onMarkDone: () => void;
  onReject: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const displayName = suggestion.companyName ?? `Kunde #${suggestion.companyId}`;
  const authorLine = [
    suggestion.foreslaaetAfNavn,
    shortDateFmt(suggestion.oprettet),
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4",
        stale && "opacity-60",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Link
          to={`/companies/${suggestion.companyId}/show`}
          className="text-base font-bold text-[var(--fg)] no-underline hover:underline"
        >
          {displayName}
        </Link>
        <span className="shrink-0 text-[13px] text-[var(--fg-2)]">
          {fieldLabel(suggestion.felt)}
        </span>
      </div>
      <div className="rounded-md bg-[var(--surface)] p-3 text-sm">
        <span className="text-[var(--fg-2)]">
          {formatFieldValue(suggestion.felt, suggestion.nuvaerendeVaerdi) ||
            "(tom)"}
        </span>
        <span className="mx-2 text-[var(--fg-3)]">→</span>
        <span className="font-medium text-[var(--fg)]">
          {formatFieldValue(suggestion.felt, suggestion.foreslaaetVaerdi)}
        </span>
      </div>
      <div className="text-[13px] text-[var(--fg-2)]">
        {authorLine}
        {suggestion.note && (
          <>
            {" · "}
            <span className="italic">"{suggestion.note}"</span>
          </>
        )}
        {stale && (
          <span className="ml-2 rounded-sm bg-[var(--surface-3)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--fg-3)]">
            over 30 dage gammelt
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onMarkDone}
          disabled={disabled}
          className="min-h-11 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          Markér rettet
        </Button>
        <RowActionsMenu
          ariaLabel="Flere handlinger"
          actions={[
            { label: "Afvis…", onSelect: onReject, destructive: true },
            { label: "Åbn kunde", onSelect: onOpen },
          ]}
        />
      </div>
    </article>
  );
}

function RejectDialog({
  suggestion,
  onClose,
  mySalesId,
}: {
  suggestion: ChangeSuggestion;
  onClose: () => void;
  mySalesId: number | null;
}) {
  const qc = useQueryClient();
  const [grund, setGrund] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      rejectSuggestion({
        id: suggestion.id,
        grund: grund.trim(),
        lukketAf: mySalesId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-change-suggestions-open"] });
      toast.success("Forslag afvist", {
        description: "Sælgeren kan se grunden på kundekortet.",
      });
      onClose();
    },
    onError: (err) =>
      toast.error("Kunne ikke afvise forslag", {
        description: readErrorMessage(err),
      }),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Afvis forslag</DialogTitle>
          <DialogDescription className="sr-only">
            Skriv en grund så sælgeren ved hvorfor.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (grund.trim()) mutation.mutate();
          }}
          className="flex flex-col"
        >
          <div className="space-y-3 px-6 pt-4 pb-4">
            <p className="text-sm text-[var(--fg-2)]">
              <span className="font-medium text-[var(--fg)]">
                {suggestion.companyName ?? `Kunde #${suggestion.companyId}`}
              </span>{" "}
              · {suggestion.felt}
              <br />
              {suggestion.nuvaerendeVaerdi?.trim() || "(tom)"} →{" "}
              {suggestion.foreslaaetVaerdi}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rej-grund" className="text-sm font-bold">
                Grund
              </Label>
              <Input
                id="rej-grund"
                autoFocus
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="fx: nummeret er stadig gyldigt, vi har lige talt med dem"
                className="min-h-11 w-full min-w-0 text-sm"
              />
              <p className="text-[12px] text-[var(--fg-3)]">
                Grunden vises for sælgeren på kundekortet.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
            >
              Annullér
            </button>
            <Button
              type="submit"
              disabled={!grund.trim() || mutation.isPending}
              variant="destructive"
              className="min-w-[120px]"
            >
              Afvis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
