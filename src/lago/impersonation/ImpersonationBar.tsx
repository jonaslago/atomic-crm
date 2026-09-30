// Domain-brief 27 §3 · Synligt bånd hele tiden.
//
// Fast bar øverst i appen mens en imperson-session er aktiv. Kan ikke
// lukkes — kun "Afslut" fjerner den, og det afslutter sessionen på
// serveren. Tydeligt anderledes end resten af fladen (advarselsfarve,
// ikke grøn — grøn er reserveret til "Ajour"), så man ikke glemmer
// at man er en anden.

import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";

import { useImpersonation } from "./useImpersonation";

const timeFmt = new Intl.NumberFormat("da-DK", {
  minimumIntegerDigits: 2,
});

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${timeFmt.format(secs)}`;
}

export function ImpersonationBar() {
  const { isImpersonating, meta, msUntilExpiry, end } = useImpersonation();
  const [ending, setEnding] = useState(false);

  if (!isImpersonating || !meta) return null;

  const targetName = meta.target.full_name ?? "ukendt bruger";
  const countdown =
    msUntilExpiry != null ? formatCountdown(msUntilExpiry) : "—";

  const handleEnd = async () => {
    setEnding(true);
    try {
      await end();
    } catch (e) {
      setEnding(false);
      alert(
        `Kunne ikke afslutte "Log ind som": ${
          readErrorMessage(e)
        }`,
      );
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // Brief 70 tillæg B (21. sep 2026): pointer-events-auto saa "Stop
      // impersonation" kan trykkes selv naar en Radix-dialog er open.
      // Ellers arves body.pointer-events:none, og admin er fastlaast i
      // target-brugerens session indtil dialogen lukkes fra target-siden.
      className="sticky top-0 z-50 pointer-events-auto flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--st-red)] bg-[var(--st-red-bg)] px-4 py-2 text-[var(--st-red-fg)]"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon icon={ShieldAlert} size="sm" />
        <span>
          Du ser systemet som <strong>{targetName}</strong>. Kun læsning.
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          · udløber om {countdown}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleEnd}
        disabled={ending}
        className="min-h-11 border-[var(--st-red)] bg-white text-[var(--st-red-fg)] hover:bg-[var(--st-red-bg)]"
      >
        {ending ? (
          <>
            <Icon icon={Loader2} size="sm" className="mr-1 animate-spin" />
            Afslutter …
          </>
        ) : (
          "Afslut"
        )}
      </Button>
    </div>
  );
}
