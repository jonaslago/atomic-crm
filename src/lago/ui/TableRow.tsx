import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · TableRow (brief 47 §2j, 16. sep 2026)
 *
 * 47 forekomster i 10 skærme. Kontorets tabeller: en række der kan
 * hoveres og som har en subtil skillelinje mod den næste. Under
 * 1280 px bliver tabellen til paneler (brief 34 §5) — så TableRow
 * bruges kun i det brede layout.
 *
 * 44 px trykmål bevares (min-h-11) selv når rækken indeholder tekst
 * der er mindre — kontoret bruger mus, men trykmålet holder rytmen.
 */

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function TableRow({ children, className, ...rest }: TableRowProps) {
  return (
    <tr
      {...rest}
      className={cn(
        "min-h-11 border-b border-[var(--line)]",
        "hover:bg-[var(--surface-2)] transition-colors",
        className,
      )}
    >
      {children}
    </tr>
  );
}
