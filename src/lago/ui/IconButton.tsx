import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

/**
 * LAGO · IconButton (brief 47 §2h, 16. sep 2026)
 *
 * 13 forekomster i 7 skærme. 44×44 px trykmål, ikon 20 px. Bruges hvor
 * handlingen er åbenlys af ikonet alene — ring op, naviger. **Aldrig
 * til noget, man kan fortryde forkert** (destruktive handlinger skal
 * altid have tekst).
 *
 * `aria-label` er påkrævet — uden det er knappen usynlig for
 * hjælpeteknologi.
 */

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Beskriv handlingen — ikke ikonet ("Ring op", ikke "Telefon"). */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, className, type = "button", ...rest }, ref) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={cn(
          "w-11 h-11 shrink-0 rounded-[var(--r-2)] bg-[var(--surface-2)]",
          "flex items-center justify-center text-[var(--fg)]",
          "transition-colors hover:bg-[var(--surface-3)]",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
      >
        <Icon icon={icon} size="sm" />
      </button>
    );
  },
);
