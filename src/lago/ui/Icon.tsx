import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * LAGO CRM · designsystem v2 — Icon (den eneste indgang til ikoner).
 *
 * Wrapper om lucide-react som fastholder de systemiske størrelser
 * (20 / 24 / 26 / 34 px) og stroke (1,9). Så kan mål og linjevægt ikke
 * skride om tre måneder.
 *
 * Regler (Domain-brief 17, trin 3):
 *   - md (24 px) er standard — lister, sidebar, knapper.
 *   - lg (26 px) er feltknapper og bund-tab.
 *   - sm (20 px) er absolut bund og kræver en grund.
 *   - empty (34 px) er tomme tilstande.
 *
 * Alle andre steder må IKKE importere et Lucide-ikon direkte. Se
 * grep-gaten i .claude/rules eller build-check for tilbagefald.
 */

export type IconSize = "sm" | "md" | "lg" | "empty";

const SIZE_PX: Record<IconSize, number> = {
  sm: 20,
  md: 24,
  lg: 26,
  empty: 34,
};

type LucideProps = ComponentPropsWithoutRef<LucideIcon>;

export interface IconProps extends Omit<LucideProps, "size"> {
  /** Lucide-ikonet (importeret som komponent i den kaldende fil). */
  icon: LucideIcon;
  /** Systemisk størrelse. Default `md` (24 px). */
  size?: IconSize;
}

export function Icon({
  icon: LucideComponent,
  size = "md",
  strokeWidth = 1.9,
  ...rest
}: IconProps) {
  return (
    <LucideComponent
      size={SIZE_PX[size]}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
}
