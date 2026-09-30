import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · StatusBadge (brief 47 §2d, 16. sep 2026)
 *
 * 33 forekomster i 7 skærme. Fire varianter: groen (kun "Ajour" jf.
 * brief 33), gul, roed, neutral (default — ikke grå-grøn).
 *
 * 🔴 Radius er --r-4 = 12 px, IKKE --r-pill (999 px). Stitchs
 * `rounded-full` i hans Tailwind-config mapper til 0.75rem (12 px),
 * ikke til kapsel. Statusmærkater skal være afrundede rektangler —
 * ikke pillekapsler — så fladen læses som et arbejdsredskab.
 *
 * Til segment (A/B/C/X/L) bruges StatusPill i stedet: segment er ikke
 * en status, og StatusBadge ejer ikke det udseende.
 */

export type StatusBadgeVariant = "groen" | "gul" | "roed" | "neutral";

const VARIANT_STYLE: Record<StatusBadgeVariant, string> = {
  groen: "bg-[var(--st-green-bg)] text-[var(--st-green-fg)]",
  gul: "bg-[var(--st-amber-bg)] text-[var(--st-amber-fg)]",
  roed: "bg-[var(--st-red-bg)] text-[var(--st-red-fg)]",
  neutral: "bg-[var(--surface-3)] text-[var(--fg-2)]",
};

export interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({
  variant = "neutral",
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[var(--r-4)]",
        "text-[length:var(--t-meta)] font-medium whitespace-nowrap",
        VARIANT_STYLE[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
