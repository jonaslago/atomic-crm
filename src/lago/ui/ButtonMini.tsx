import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/lago/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * @deprecated Brug `Button` fra `./Button` i stedet — variant
 * `"secondary"` giver samme rolle (brief 47 §2i, 16. sep 2026). Brief
 * 47 skar knap-udseendet ned til to varianter: sort primær og neutral
 * sekundær. Rammer + accent-ikon-udseendet fra ButtonMini er ikke i
 * det nye lag.
 *
 * ButtonMini bevares uændret indtil eksisterende brug er konverteret;
 * ingen nyt arbejde må importere den. Konverteringen sker skærm for
 * skærm efter brief 45 og fremad — ikke som en samlet operation.
 *
 * LAGO CRM · designsystem v2 — ButtonMini.
 *
 * Til små handlinger inde i en tonet blok (fx Ring/Mail på kundekortet).
 * Erstatter det tidligere pill-look: en pill er en tilstand man LÆSER,
 * en knap er noget man TRYKKER PÅ. Tonet-på-tonet forsvinder — hvid
 * flade med kraftig kant, accent-farvet ikon, 44 px tap-mål gør den
 * trygbar i felten.
 *
 * Spec (afsnit 2.5 i implementeringsdokumentet):
 *   hvid flade · 1,5 px kant (--line-strong) · 20 px ikon i --a-deep
 *   · 700-vægt tekst · 44 px høj (--tap) · gap 7 px · padding 9/14 px
 */

export interface ButtonMiniProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  children: ReactNode;
}

export function ButtonMini({
  icon,
  children,
  className,
  type = "button",
  ...rest
}: ButtonMiniProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-[7px]",
        "min-h-[var(--tap)] rounded-[var(--r-2)] px-[14px] py-[9px]",
        "border-[1.5px] border-[var(--line-strong)] bg-[var(--surface)]",
        "text-sm font-bold text-[var(--fg)]",
        "transition-colors hover:bg-[var(--surface-2)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon icon={icon} size="sm" className="text-[var(--a-deep)]" />
      {children}
    </button>
  );
}
