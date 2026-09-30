import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { APP_STATE_KEY } from "./useAppState";
import { lukOpIgen, type AppState } from "./dataAccess";

/**
 * Brief 57 §4 · admin-stribe. lago_role='admin' rammer aldrig sælger-
 * skærmen — ellers kan admin ikke kontrollere resultatet af det, hun
 * lige har kørt. Men hun skal se det HELE tiden: en amber-stribe
 * øverst på hver skærm så længe vinduet er aktivt.
 *
 * "Luk op igen" ligger direkte i striben — man skal ikke finde vej til
 * Indstillinger for at fortryde.
 */

function formatSlutterHhMm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}.${mm}`;
}

export function MaintenanceBanner({ state }: { state: AppState }) {
  const qc = useQueryClient();
  const luk = useMutation({
    mutationFn: lukOpIgen,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APP_STATE_KEY });
      toast.success("Vedligeholdelse slået fra");
    },
    onError: (err) =>
      toast.error("Kunne ikke slå fra", {
        description: readErrorMessage(err),
      }),
  });

  const slutterHhMm = formatSlutterHhMm(state.slutter);

  return (
    <div className="sticky top-0 z-[70] pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-amber-fg)]/30 bg-[var(--st-amber-bg)] px-4 py-2 text-sm">
      {/* Brief 70 tillæg B (21. sep 2026): pointer-events-auto saa
          banneret forbliver interaktivt naar en Radix-dialog er open
          (body.pointer-events:none ellers). Vedligeholdelses-info skal
          kunne laeses OG evt. dismisses selv midt i et preview. */}
      <div className="flex items-start gap-2 text-[var(--st-amber-fg)]">
        <Icon icon={AlertTriangle} size="sm" className="mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Vedligeholdelse er slået til</span>
          <span className="text-[var(--fg-2)]">
            {" "}— sælgerne kan ikke komme ind
            {slutterHhMm && <>. Åbner igen {slutterHhMm}</>}.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => luk.mutate()}
        disabled={luk.isPending}
        className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--r-2)] bg-[var(--ink)] px-3 text-[13px] font-medium text-white hover:bg-[var(--ink)]/90 disabled:opacity-50"
      >
        Luk op igen
      </button>
    </div>
  );
}
