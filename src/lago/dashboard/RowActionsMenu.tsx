// Brief 34 tillæg A §0: hver blok har præcis én primær handling.
// Sekundære må findes men må aldrig konkurrere visuelt — er der ikke
// plads, går de bag et 44×44 px ⋯. De forsvinder ikke.
//
// Denne komponent er den delte ⋯-knap. Bruges af alle widget-rækker.

import { MoreHorizontal } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/lago/ui/Icon";

export interface RowAction {
  label: string;
  onSelect: () => void;
  href?: string;
  destructive?: boolean;
}

/**
 * Sekundær-menu til en række. Trigger er en 44×44 px ⋯-knap (bridge.css
 * trykmål-gulvet). Menuen bruger shadcn DropdownMenu.
 */
export function RowActionsMenu({
  actions,
  ariaLabel = "Flere handlinger",
}: {
  actions: RowAction[];
  ariaLabel?: string;
}): ReactNode {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-[var(--fg-2)] hover:bg-[var(--surface-3)]"
          aria-label={ariaLabel}
        >
          <Icon icon={MoreHorizontal} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onSelect={a.onSelect}
            className={a.destructive ? "text-[var(--st-red-fg)]" : ""}
          >
            {a.href ? (
              <a href={a.href} className="block w-full">
                {a.label}
              </a>
            ) : (
              a.label
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
