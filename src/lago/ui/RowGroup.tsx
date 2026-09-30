import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · RowGroup (brief 47 §2g, 16. sep 2026)
 *
 * 16 forekomster i 5 skærme. Rækker i en sektion, adskilt af en
 * skillelinje. **Ingen streg efter den sidste** og **ingen luft mod
 * sektionens egen kant** — det er hele pointen med `first:pt-0
 * last:pb-0`.
 *
 * Semantisk: default <ul>. Sæt `as="ol"` når rækkefølgen betyder noget
 * (fx nummereret arbejdsgang).
 */

export interface RowGroupProps {
  children: ReactNode;
  className?: string;
  as?: "ul" | "ol" | "div";
}

export function RowGroup({ children, className, as = "ul" }: RowGroupProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "divide-y divide-[var(--line)]",
        "[&>*]:py-2 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0",
        Tag === "ul" || Tag === "ol" ? "list-none pl-0" : "",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
