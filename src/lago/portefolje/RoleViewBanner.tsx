import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/lago/ui/Icon";

import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";
import { usePortefolje, usePortefoljeActions } from "./PortefoljeContext";

/**
 * Brief 84 tillæg A §3 (28. sep 2026) · rolle-visning-bånd.
 *
 * Kortere end dæknings-båndet — det er ikke en arbejdstilstand.
 * "Du ser kontorets forside med dine egne data."
 *
 * En rolle-visning der ikke er mærket, er en skærm man tror er sin
 * egen. Briefen kræver at det står synligt.
 */

const ROLE_LABELS: Record<LagoRole, string> = {
  saelger: "sælgerens",
  kontor: "kontorets",
  ledelse: "ledelsens",
  admin: "admin-",
};

export function RoleViewBanner() {
  const { isRoleView, viewRole } = usePortefolje();
  const { clearRoleView } = usePortefoljeActions();

  if (!isRoleView) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-1)] px-4 py-2 text-[var(--fg)]"
    >
      <Icon icon={Eye} size="sm" className="shrink-0 text-[var(--fg-2)]" />
      <p className="min-w-0 flex-1 text-sm">
        {/* §31b: kontor's banner was wrong — kontorets kø is not "dine
            egne data". The queue belongs to the team. */}
        {viewRole === "kontor"
          ? "Du ser kontorets forside. Dine egne tal, kontorets fælles lister."
          : `Du ser ${ROLE_LABELS[viewRole]} forside med dine egne data.`}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearRoleView}
        className="shrink-0 gap-1.5"
      >
        <Icon icon={X} size="sm" />
        Min forside
      </Button>
    </div>
  );
}
