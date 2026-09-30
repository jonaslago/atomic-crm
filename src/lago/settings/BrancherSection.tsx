import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Button as LagoButton } from "@/lago/ui/Button";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import {
  fetchBrancher,
  fetchUmappedeBrancher,
  insertBranche,
  updateBranche,
  type Branche,
  type UmappetBranche,
} from "./brancherDataAccess";

/**
 * Brief 53 §3 + Brief 55 tillæg A (17. sep 2026) · Brancher-sektion.
 *
 * Referencelisten kan vedligeholdes af admin: omdøb, deaktivér, tilføj
 * ny. Deaktivering IKKE sletning — en branche i brug på en kunde må
 * ikke kunne forsvinde. Umappede-listen viser rå værdier fra
 * companies_lago.branche_visma_tekst der ikke matcher nogen kode; en
 * ét-klik-knap opretter den som ny med samme kode. Så listen ikke
 * kommer bagud, når VISMA tilføjer kategorier.
 */
export function BrancherSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["lago-brancher"],
    queryFn: fetchBrancher,
  });
  const umappedeQuery = useQuery({
    queryKey: ["lago-brancher-umappede"],
    queryFn: fetchUmappedeBrancher,
    staleTime: 60_000,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["lago-brancher"] });
    qc.invalidateQueries({ queryKey: ["lago-brancher-umappede"] });
  };

  const toggleAktiv = useMutation({
    mutationFn: async ({
      kode,
      aktiv,
    }: {
      kode: number;
      aktiv: boolean;
    }) => updateBranche(kode, { aktiv }),
    onSuccess: () => invalidateAll(),
    onError: (err) =>
      toast.error("Kunne ikke opdatere branche", {
        description: readErrorMessage(err),
      }),
  });

  const renameBranche = useMutation({
    mutationFn: async ({
      kode,
      navn,
    }: {
      kode: number;
      navn: string;
    }) => updateBranche(kode, { navn: navn.trim() }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Branche omdøbt");
    },
    onError: (err) =>
      toast.error("Kunne ikke omdøbe branche", {
        description: readErrorMessage(err),
      }),
  });

  const addBranche = useMutation({
    mutationFn: async (input: { kode: number; navn: string }) =>
      insertBranche({ kode: input.kode, navn: input.navn.trim(), aktiv: true }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Branche oprettet");
    },
    onError: (err) =>
      toast.error("Kunne ikke oprette branche", {
        description: readErrorMessage(err),
      }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">Brancher</CardTitle>
        <p className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
          VISMA-koderne som referenceliste. Deaktivér én der er udgået —
          slet ikke, kunder der bærer den beholder værdien.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {listQuery.isPending ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--fg-2)]">
            <Icon icon={Loader2} className="animate-spin" />
            Henter brancher…
          </div>
        ) : listQuery.error ? (
          <p className="py-4 text-sm text-[var(--st-red-fg)]">
            Kunne ikke hente brancher.
          </p>
        ) : (
          <BrancheListe
            brancher={listQuery.data ?? []}
            isAdmin={isAdmin}
            onToggleAktiv={(kode, aktiv) =>
              toggleAktiv.mutate({ kode, aktiv })
            }
            onRename={(kode, navn) => renameBranche.mutate({ kode, navn })}
            saving={toggleAktiv.isPending || renameBranche.isPending}
          />
        )}
        {isAdmin && (
          <AddBrancheForm
            existingKoder={new Set((listQuery.data ?? []).map((b) => b.kode))}
            onSubmit={(kode, navn) => addBranche.mutate({ kode, navn })}
            disabled={addBranche.isPending}
          />
        )}
        <UmappedeBlok
          umappede={umappedeQuery.data ?? []}
          existingKoder={new Set((listQuery.data ?? []).map((b) => b.kode))}
          isAdmin={isAdmin}
          isPending={umappedeQuery.isPending}
          onCreate={(kode, navn) => addBranche.mutate({ kode, navn })}
        />
      </CardContent>
    </Card>
  );
}

function BrancheListe({
  brancher,
  isAdmin,
  onToggleAktiv,
  onRename,
  saving,
}: {
  brancher: Branche[];
  isAdmin: boolean;
  onToggleAktiv: (kode: number, aktiv: boolean) => void;
  onRename: (kode: number, navn: string) => void;
  saving: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-[var(--line)]">
      {brancher.map((b) => (
        <BrancheRow
          key={b.kode}
          branche={b}
          isAdmin={isAdmin}
          onToggleAktiv={onToggleAktiv}
          onRename={onRename}
          disabled={saving}
        />
      ))}
    </ul>
  );
}

function BrancheRow({
  branche,
  isAdmin,
  onToggleAktiv,
  onRename,
  disabled,
}: {
  branche: Branche;
  isAdmin: boolean;
  onToggleAktiv: (kode: number, aktiv: boolean) => void;
  onRename: (kode: number, navn: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [navn, setNavn] = useState(branche.navn);
  const commit = () => {
    if (navn.trim() && navn.trim() !== branche.navn) {
      onRename(branche.kode, navn);
    }
    setEditing(false);
  };
  return (
    <li
      className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${
        branche.aktiv ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="w-10 shrink-0 text-[length:var(--t-meta)] font-mono text-[var(--fg-3)] tabular-nums">
          {branche.kode}
        </span>
        {editing ? (
          <Input
            autoFocus
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setNavn(branche.navn);
                setEditing(false);
              }
            }}
            className="min-h-9 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => isAdmin && setEditing(true)}
            className={`text-left text-sm ${
              isAdmin ? "hover:underline underline-offset-2" : ""
            } text-[var(--fg)] truncate`}
            disabled={!isAdmin}
          >
            {branche.navn}
          </button>
        )}
      </div>
      {isAdmin && (
        <label className="flex shrink-0 items-center gap-2 text-[length:var(--t-sec)] text-[var(--fg-2)]">
          <input
            type="checkbox"
            checked={branche.aktiv}
            onChange={(e) => onToggleAktiv(branche.kode, e.target.checked)}
            disabled={disabled}
            className="h-5 w-5 accent-[var(--ink)]"
          />
          Aktiv
        </label>
      )}
    </li>
  );
}

function AddBrancheForm({
  existingKoder,
  onSubmit,
  disabled,
}: {
  existingKoder: Set<number>;
  onSubmit: (kode: number, navn: string) => void;
  disabled: boolean;
}) {
  const [kode, setKode] = useState("");
  const [navn, setNavn] = useState("");
  const kodeNum = parseInt(kode, 10);
  const canSubmit =
    Number.isFinite(kodeNum) &&
    kodeNum > 0 &&
    !existingKoder.has(kodeNum) &&
    navn.trim().length > 0 &&
    !disabled;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(kodeNum, navn);
        setKode("");
        setNavn("");
      }}
      className="flex flex-col gap-2 rounded-[var(--r-2)] bg-[var(--surface-1)] p-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1.5 sm:w-24">
        <Label htmlFor="ny-branche-kode" className="text-[length:var(--t-meta)]">
          Kode
        </Label>
        <Input
          id="ny-branche-kode"
          type="number"
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          className="min-h-11 text-sm"
        />
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <Label htmlFor="ny-branche-navn" className="text-[length:var(--t-meta)]">
          Navn
        </Label>
        <Input
          id="ny-branche-navn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          className="min-h-11 text-sm"
        />
      </div>
      <LagoButton
        variant="secondary"
        icon={Plus}
        disabled={!canSubmit}
      >
        Tilføj
      </LagoButton>
    </form>
  );
}

function UmappedeBlok({
  umappede,
  existingKoder,
  isAdmin,
  isPending,
  onCreate,
}: {
  umappede: UmappetBranche[];
  existingKoder: Set<number>;
  isAdmin: boolean;
  isPending: boolean;
  onCreate: (kode: number, navn: string) => void;
}) {
  if (isPending) return null;
  if (umappede.length === 0) {
    return (
      <div className="rounded-[var(--r-2)] bg-[var(--surface-1)] p-3">
        <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
          Alle branche-værdier fra importen mapper til en kendt kode.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--r-2)] border border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)]/50 p-3">
      <p className="mb-2 text-[length:var(--t-sec)] font-medium text-[var(--fg)]">
        {umappede.length} branche-værdi
        {umappede.length === 1 ? "" : "er"} fra sidste import kunne ikke
        genkendes:
      </p>
      <ul className="flex flex-col gap-2">
        {umappede.map((u) => {
          const kodeNum = parseInt(u.vaerdi, 10);
          const alreadyExists =
            Number.isFinite(kodeNum) && existingKoder.has(kodeNum);
          return (
            <li
              key={u.vaerdi}
              className="flex items-center justify-between gap-3 rounded-[var(--r-2)] bg-[var(--surface)] p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fg)]">
                  "{u.vaerdi}"
                </p>
                <p className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                  {u.antal} kunde{u.antal === 1 ? "" : "r"}
                </p>
              </div>
              {isAdmin && Number.isFinite(kodeNum) && !alreadyExists && (
                <LagoButton
                  variant="secondary"
                  onClick={() =>
                    onCreate(kodeNum, `Uspecificeret kode ${kodeNum}`)
                  }
                >
                  Opret som kode {kodeNum}
                </LagoButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
