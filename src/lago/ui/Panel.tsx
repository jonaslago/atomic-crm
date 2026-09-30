import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · Panel (brief 47 §2b, rev. brief 85 §1 · 28. sep 2026)
 *
 * 33 forekomster i 5 skærme. Rækken man handler på: et kundekort,
 * en dagsplan-blok, en registrering. Ingen ramme, ingen skygge —
 * adskillelsen er fladen (--surface hvid mod --canvas beige), ikke
 * en streg. Radius 4 px (--r-2), padding 12 px.
 *
 * Brief 85 §1 (28. sep 2026): byttet fra --surface-1 (grå) til
 * --surface (hvid). Fem trin ud af 255 var ikke en adskillelse; med
 * hvidt kort på beige side flyder skærmen ikke længere sammen.
 * Inset er samtidig byttet den anden vej (grå indstik inde i hvidt
 * kort) — se Inset.tsx.
 */

export interface PanelProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}

export function Panel({ children, className, as = "div" }: PanelProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "bg-[var(--surface)] rounded-[var(--r-2)] p-3",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
