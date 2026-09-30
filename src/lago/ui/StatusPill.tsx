import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * @deprecated Brug `StatusBadge` fra `./StatusBadge` i stedet (brief 47
 * §2d, 16. sep 2026). StatusPill bruger pill-radius (999 px), men
 * Stitchs faktiske design er afrundede rektangler (12 px). Fladen skal
 * læses som et arbejdsredskab, ikke som mærkater.
 *
 * StatusPill bevares uændret indtil eksisterende brug er konverteret;
 * ingen nyt arbejde må importere den. Konverteringen sker skærm for
 * skærm efter brief 45 og fremad — ikke som en samlet operation.
 *
 * LAGO CRM · designsystem v2 — StatusPill.
 *
 * Den ENESTE indgang til status-farver. Håndhæver at rød/gul/grøn/grå/blå
 * altid betyder noget — segment (A/B/C/X) er ikke en status og bruger IKKE
 * denne komponent (segment-pills er neutrale outline).
 *
 * Spec: 13 px (`--t-meta`), bold, `--r-pill` (pill-radius). Farverne kommer
 * fra token-parret `--st-*-bg` (baggrund) + `--st-*-fg` (tekst) fra
 * tokens.css.
 */

export type StatusVariant = "red" | "amber" | "green" | "grey" | "blue";

const VARIANT_STYLE: Record<StatusVariant, string> = {
  red: "bg-[var(--st-red-bg)] text-[var(--st-red-fg)]",
  amber: "bg-[var(--st-amber-bg)] text-[var(--st-amber-fg)]",
  green: "bg-[var(--st-green-bg)] text-[var(--st-green-fg)]",
  grey: "bg-[var(--st-grey-bg)] text-[var(--st-grey-fg)]",
  blue: "bg-[var(--st-blue-bg)] text-[var(--st-blue-fg)]",
};

export interface StatusPillProps {
  variant: StatusVariant;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5",
        "text-[13px] font-bold whitespace-nowrap tabular-nums",
        VARIANT_STYLE[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
