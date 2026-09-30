import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { APP_STATE_KEY, useAppState } from "@/lago/appstate/useAppState";
import {
  isMaintenanceActive,
  lukOpIgen,
  slaaMaintenanceTil,
} from "@/lago/appstate/dataAccess";

/**
 * Brief 57 §1-§2 · admin-flade for vedligeholdelsestilstand.
 *
 * Form: vælg varighed (15/30/60/120 min) + valgfri besked. Ved tilslag
 * sættes `slutter = now() + minutter`. Kan forlænges ved nyt tryk mens
 * vinduet er aktivt (samme knap, overskriver slutter).
 *
 * "Luk op igen" slår fra før tid. Ordet siger hvad der sker — modsat
 * "Slå fra" som er cirkulært (fra hvad?).
 */

const VARIGHED_OPTIONS: Array<{ value: string; label: string; minutes: number }> = [
  { value: "15", label: "15 min", minutes: 15 },
  { value: "30", label: "30 min", minutes: 30 },
  { value: "60", label: "1 time", minutes: 60 },
  { value: "120", label: "2 timer", minutes: 120 },
];

function formatHhMm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}.${mm}`;
}

export function MaintenanceSection({ isAdmin }: { isAdmin: boolean }) {
  const { state } = useAppState();
  const active = isMaintenanceActive(state);
  const { data: identity } = useGetIdentity();
  const salesId = typeof identity?.id === "number" ? identity.id : null;
  const qc = useQueryClient();

  const [varighed, setVarighed] = useState<string>("15");
  const [besked, setBesked] = useState<string>("");

  // Ved åbning: hvis der er et aktivt vindue, forudfyld beskeden så
  // "forlæng" ikke sletter den utilsigtet.
  useEffect(() => {
    if (active && state.besked) setBesked(state.besked);
  }, [active, state.besked]);

  const slaaTil = useMutation({
    mutationFn: () => {
      const minutes = VARIGHED_OPTIONS.find((v) => v.value === varighed)?.minutes ?? 15;
      return slaaMaintenanceTil({
        minutes,
        besked: besked.trim() || null,
        slaaetTilAfSalesId: salesId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APP_STATE_KEY });
      toast.success(
        active ? "Vedligeholdelse forlænget" : "Vedligeholdelse slået til",
      );
    },
    onError: (err) =>
      toast.error("Kunne ikke slå til", {
        description: readErrorMessage(err),
      }),
  });

  const lukOp = useMutation({
    mutationFn: lukOpIgen,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APP_STATE_KEY });
      toast.success("Vedligeholdelse slået fra");
      setBesked("");
    },
    onError: (err) =>
      toast.error("Kunne ikke slå fra", {
        description: readErrorMessage(err),
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vedligeholdelsestilstand</CardTitle>
      </CardHeader>
      <CardContent>
        {!isAdmin && (
          <p className="text-sm text-[var(--fg-2)]">
            Kun admin kan slå vedligeholdelse til.
          </p>
        )}
        {isAdmin && (
          <div className="flex flex-col gap-4">
            {active && (
              <div className="flex items-start gap-2 rounded-[var(--r-2)] border border-[var(--st-amber-fg)]/30 bg-[var(--st-amber-bg)] px-3 py-2 text-sm">
                <Icon
                  icon={AlertTriangle}
                  size="sm"
                  className="mt-0.5 shrink-0 text-[var(--st-amber-fg)]"
                />
                <div>
                  <p className="font-medium text-[var(--st-amber-fg)]">
                    Aktivt — åbner igen {formatHhMm(state.slutter)}
                  </p>
                  {state.besked && (
                    <p className="mt-0.5 text-[var(--fg-2)]">
                      Besked til brugerne: {state.besked}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="m-varighed" className="text-sm">
                  {active ? "Forlæng i" : "Slå til i"}
                </Label>
                <Select value={varighed} onValueChange={setVarighed}>
                  <SelectTrigger id="m-varighed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIGHED_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-besked" className="text-sm">
                  Besked{" "}
                  <span className="text-[var(--fg-3)]">(valgfri)</span>
                </Label>
                <Input
                  id="m-besked"
                  value={besked}
                  onChange={(e) => setBesked(e.target.value)}
                  placeholder="fx: Vi opdaterer kundedata"
                  className="min-h-11"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {active && (
                <button
                  type="button"
                  onClick={() => lukOp.mutate()}
                  disabled={lukOp.isPending}
                  className="min-h-11 text-sm text-[var(--fg-2)] underline underline-offset-2 hover:text-[var(--fg)] disabled:opacity-50"
                >
                  Luk op igen
                </button>
              )}
              <Button
                type="button"
                onClick={() => slaaTil.mutate()}
                disabled={slaaTil.isPending}
                className="min-h-11 gap-2 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
              >
                {slaaTil.isPending && (
                  <Icon icon={Loader2} className="animate-spin" />
                )}
                {active ? "Forlæng" : "Slå til"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
