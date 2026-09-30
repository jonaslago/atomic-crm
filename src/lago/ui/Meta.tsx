import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · Meta (brief 47 §2e, 16. sep 2026)
 *
 * 57 forekomster i 10 skærme — ét af hans mest gennemgående greb.
 * Teksten til højre for en overskrift: "3 aktiviteter", "2 personer",
 * "Uge 21". Formålet er, at man kan **se omfanget uden at tælle.**
 *
 * Bruges typisk inde i SectionHeader; kan også stå selv, fx i et
 * kort-header eller ved siden af en handling.
 */

export interface MetaProps {
  children: ReactNode;
  className?: string;
}

export function Meta({ children, className }: MetaProps) {
  return (
    <span
      className={cn(
        "text-[length:var(--t-meta)] text-[var(--fg-3)] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
