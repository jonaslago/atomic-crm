import { Users2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/lago/ui/Icon";

import { usePortefolje, usePortefoljeActions } from "./PortefoljeContext";

/**
 * Brief 84 §5 (28. sep 2026) · dæknings-bånd.
 *
 * "Du passer Camilla Uhre Pedersens kunder. Alt, du registrerer,
 *  står i dit navn. [Tilbage til mine]"
 *
 * Bevidst anden ordlyd end det gamle impersonation-bånd. Det gamle
 * sagde "du er en anden". Dette siger "du er dig, og du arbejder her".
 * Forskellen skal stå på skærmen, ikke kun i briefen.
 *
 * Vises hele tiden mens isCovering === true, sticky øverst så den
 * ikke glider ud af syne. Placeret i LagoLayout FØR headeren.
 */
export function CoverageBanner() {
  const { isCovering, viewLabel } = usePortefolje();
  const { endCoverage } = usePortefoljeActions();

  if (!isCovering) return null;

  const label = viewLabel ?? "en kollega";

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--st-amber-bg)] px-4 py-2 text-[var(--st-amber-fg)]"
    >
      <Icon icon={Users2} size="sm" className="shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Du passer {label}s kunder.</span>{" "}
        <span className="text-[var(--fg-2)]">
          Alt, du registrerer, står i dit navn.
        </span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void endCoverage();
        }}
        className="shrink-0 gap-1.5 text-[var(--st-amber-fg)] hover:bg-[var(--st-amber-bg)]/70"
      >
        <Icon icon={X} size="sm" />
        Tilbage til mine
      </Button>
    </div>
  );
}
