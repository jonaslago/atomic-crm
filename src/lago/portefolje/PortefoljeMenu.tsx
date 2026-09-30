import { Eye, Users2 } from "lucide-react";
import { useUserMenu } from "ra-core";

import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/lago/ui/Icon";

import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";
import { usePortefolje, usePortefoljeActions } from "./PortefoljeContext";
import { useCoveragePeople } from "./useCoveragePeople";

/**
 * Brief 84 tillæg A §3 (28. sep 2026) · avatar-menu-tilføjelser.
 *
 * To indgange:
 *   - "Se som rolle" → dine egne data i en anden rolles layout
 *   - "Passer for"   → en kollegas data + hendes layout
 *
 * De to er gensidigt udelukkende — vælger man en person, følger hendes
 * rolle med. At kombinere "kontorets layout med Camillas data" er en
 * kombination ingen har bedt om, og den ville kun forvirre.
 */

const ROLE_LABELS: Record<LagoRole, string> = {
  saelger: "Sælger",
  kontor: "Kontor",
  ledelse: "Ledelse",
  admin: "Admin",
};

const ROLE_ORDER: LagoRole[] = ["saelger", "kontor", "ledelse", "admin"];

export function SeSomRolleMenuItem() {
  const { viewRole, isRoleView, actorRole } = usePortefolje();
  const { setRoleView, clearRoleView } = usePortefoljeActions();
  const userMenu = useUserMenu();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Icon icon={Eye} size="sm" />
        Se som rolle
        {isRoleView && (
          <span className="text-muted-foreground ml-auto text-xs">
            {ROLE_LABELS[viewRole]}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {ROLE_ORDER.map((r) => {
          const isCurrent = isRoleView && viewRole === r;
          const isOwn = r === actorRole && !isRoleView;
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => {
                if (r === actorRole) {
                  clearRoleView();
                } else {
                  setRoleView(r);
                }
                userMenu?.onClose();
              }}
              className={isCurrent ? "font-medium" : undefined}
            >
              {ROLE_LABELS[r]}
              {isOwn && (
                <span className="text-muted-foreground ml-auto text-xs">
                  (min)
                </span>
              )}
              {isCurrent && (
                <span className="text-muted-foreground ml-auto text-xs">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function PasserForMenuItem() {
  const { isCovering, viewLabel } = usePortefolje();
  const { startCoverage, endCoverage } = usePortefoljeActions();
  const { people, isLoading } = useCoveragePeople();
  const userMenu = useUserMenu();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Icon icon={Users2} size="sm" />
        Passer for
        {isCovering && viewLabel && (
          <span className="text-muted-foreground ml-auto max-w-[10rem] truncate text-xs">
            {viewLabel}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {isLoading && (
          <DropdownMenuItem disabled>Henter kolleger…</DropdownMenuItem>
        )}
        {!isLoading && people.length === 0 && (
          <DropdownMenuItem disabled>Ingen kolleger fundet</DropdownMenuItem>
        )}
        {people.map((p) => (
          <DropdownMenuItem
            key={p.salesId}
            onClick={() => {
              void startCoverage({
                salesId: p.salesId,
                userId: p.userId,
                label: p.label,
                role: p.role,
              });
              userMenu?.onClose();
            }}
          >
            {p.label}
            <span className="text-muted-foreground ml-auto text-xs">
              {ROLE_LABELS[p.role]}
            </span>
          </DropdownMenuItem>
        ))}
        {isCovering && (
          <DropdownMenuItem
            onClick={() => {
              void endCoverage();
              userMenu?.onClose();
            }}
            className="text-destructive"
          >
            Stop dækning
          </DropdownMenuItem>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
