import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · SectionHeader (brief 47 §2f, 16. sep 2026)
 *
 * Overskriften til venstre, omfanget til højre. Altid. Højre-siden er
 * enten <Meta> ("3 aktiviteter") eller <StatusBadge> ("Overskredet").
 * Fed body-tekst — ikke title-store — så mange sektioner kan stå på
 * samme skærm uden at kappes op i "kapitler".
 *
 * Brief 49 §3 (17. sep 2026): tilføjet `variant="label"` (versaler
 * udspærret i --fg-3) og `action` (link helt til højre) samt
 * `subtitle` (grå tekst efter titlen med · separator). Bruges på
 * laptop-kundekortet hvor sektionsoverskriften er "AKTIVITETSHISTORIK
 * · 3 seneste henvendelser [Ny intern note →]".
 */

export type SectionHeaderVariant = "regular" | "label";

export interface SectionHeaderProps {
  /** Overskriften — typisk en spørgsmåls-formulering (brief 34 §1).
   *  På variant="label" udgøres i versaler + udspærring. */
  title: ReactNode;
  /** Grå tekst efter titlen ("3 seneste henvendelser"). Kun på
   *  variant="label" — så ligger separator og størrelse rigtigt. */
  subtitle?: ReactNode;
  /** Tallet/statussen til højre. Bruges ved variant="regular"
   *  (fx <Meta> eller <StatusBadge>). */
  right?: ReactNode;
  /** Handlings-link helt til højre ("Ny intern note",
   *  "Opret opfølgning"). */
  action?: ReactNode;
  /** Regular = fed body-tekst. Label = versaler + udspærring +
   *  --fg-3 farve. Default regular. */
  variant?: SectionHeaderVariant;
  /** Overskriftens semantiske niveau — som h-tag. Default h3 fordi
   *  SectionHeader typisk står under en sides h1/h2. */
  as?: "h2" | "h3" | "h4";
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  right,
  action,
  variant = "regular",
  as = "h3",
  className,
}: SectionHeaderProps) {
  const Tag = as;
  const isLabel = variant === "label";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        isLabel
          ? "border-b border-[var(--line)] pb-2 mb-3"
          : "mb-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <Tag
          className={cn(
            isLabel
              ? "text-[length:var(--t-body)] font-bold text-[var(--fg)] uppercase tracking-wider"
              : "text-[length:var(--t-body)] font-bold text-[var(--fg)]",
          )}
        >
          {title}
        </Tag>
        {subtitle && (
          <span className="text-[length:var(--t-meta)] text-[var(--fg-3)] truncate">
            <span aria-hidden className="mr-2">·</span>
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right && <span>{right}</span>}
        {action && <span>{action}</span>}
      </div>
    </div>
  );
}
