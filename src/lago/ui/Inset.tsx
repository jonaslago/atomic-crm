import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LAGO · Inset (brief 47 §2c, rev. brief 85 §1 · 28. sep 2026)
 *
 * 56 forekomster i 9 skærme — den er den, der giver dybden. Det GRÅ
 * felt inde i et Panel: en note, et citat, et aftale-uddrag. Bruges
 * ALDRIG udenfor et Panel (så bliver det bare et gråt rektangel på
 * en beige canvas — kun mærkbart hvis Panel ligger imellem).
 *
 * Brief 85 §1 (28. sep 2026): byttet fra --surface (hvid) til
 * --surface-1 (grå). Sammen med Panels bytte til hvid giver det
 * Stitchs faktiske flade: beige side · hvidt kort · gråt indstik.
 * Radius 4 px, padding 8 px — mindre end Panel så trin-forskellen
 * læses.
 */

export interface InsetProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "p" | "blockquote";
}

export function Inset({ children, className, as = "div" }: InsetProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "bg-[var(--surface-1)] rounded-[var(--r-2)] p-2",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
