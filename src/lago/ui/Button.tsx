import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

/**
 * LAGO · Button (brief 47 §2i, 16. sep 2026)
 *
 * To varianter, ikke flere.
 *   primær   — bg-[var(--ink)] text-white   · 138 forekomster i 18 skærme
 *   sekundær — bg-[var(--surface-3)]        · resten
 *
 * Én primær pr. blok (tillæg A til brief 34 §0). Ikonet står ved
 * SIDEN af teksten — aldrig over. Vi bruger IKKE hans
 * tre-lige-knapper-gitter (Jonas afviste det, brief 37 rettede det).
 *
 * Adskilt fra shadcns generelle Button (`@/components/ui/button`),
 * som har mange varianter og hører til admin-siderne. Denne er LAGO-
 * specifik: to udseender, ingen valgfriheder.
 */

export type LagoButtonVariant = "primary" | "secondary";

const VARIANT_STYLE: Record<LagoButtonVariant, string> = {
  primary:
    "bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90 " +
    "active:bg-[var(--ink)]/80",
  secondary:
    "bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-3)]/80",
};

export interface LagoButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: LagoButtonVariant;
  /** Valgfrit ikon foran teksten. */
  icon?: LucideIcon;
  /** Bruges når trykmål skal være 48 px (hovedhandling) i stedet for
   *  standard 44 px. */
  primaryHeight?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, LagoButtonProps>(
  function Button(
    {
      variant = "primary",
      icon,
      primaryHeight = false,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={cn(
          primaryHeight ? "min-h-12" : "min-h-11",
          "inline-flex items-center justify-center gap-2 px-4",
          "rounded-[var(--r-2)] text-[length:var(--t-sec)] font-medium",
          "transition-colors disabled:opacity-50 disabled:pointer-events-none",
          VARIANT_STYLE[variant],
          className,
        )}
      >
        {icon && <Icon icon={icon} size="sm" />}
        {children}
      </button>
    );
  },
);
