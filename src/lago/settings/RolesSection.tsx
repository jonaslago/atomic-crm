import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";
import { StatusPill } from "@/lago/ui/StatusPill";
import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";

import {
  fetchCrmLogins,
  LastAdminError,
  updateSalesLagoRole,
  type CrmLoginRow,
} from "./dataAccess";

const ROLE_LABEL: Record<LagoRole, string> = {
  saelger: "Sælger",
  kontor: "Kontor",
  ledelse: "Ledelse",
  admin: "Admin",
};

/**
 * RolesSection — tildel LAGO-rolle til ALLE CRM-brugere.
 *
 * SellersSection viser VISMA-sælgere (fra lago_sellers) og kan kun
 * ændre rollen på sælgere der har CRM-login. Denne sektion viser
 * public.sales direkte, så admins kan tildele roller uden at
 * afhænge af VISMA-koblingen — vigtigt når der oprettes nye
 * dashboard-brugere (kontor, ledelse) der ikke nødvendigvis er
 * sælgere.
 *
 * Kun synlig for admins. Ikke-admin får blank sektion (samme mønster
 * som andre admin-only sektioner).
 */
export function RolesSection({ isAdmin }: { isAdmin: boolean }) {
  const translate = useTranslate();
  const qc = useQueryClient();

  const logins = useQuery({
    queryKey: ["lago-crm-logins"],
    queryFn: fetchCrmLogins,
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: updateSalesLagoRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-crm-logins"] });
      qc.invalidateQueries({ queryKey: ["lago-admin-flag"] });
      qc.invalidateQueries({ queryKey: ["lago-current-role"] });
      toast.success(translate("lago.settings.sellers.role_saved", { _: "Rolle gemt" }));
    },
    onError: (err) => {
      if (err instanceof LastAdminError) {
        toast.error(translate("lago.settings.sellers.admin_last_error"));
        return;
      }
      toast.error(translate("lago.settings.sellers.save_failed"), {
        description: readErrorMessage(err),
      });
    },
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brugere og roller</CardTitle>
      </CardHeader>
      <CardContent>
        {logins.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            Henter brugere …
          </div>
        ) : logins.isError ? (
          <div className="text-[var(--st-red-fg)] text-sm">
            Kunne ikke hente brugere.
          </div>
        ) : (logins.data ?? []).length === 0 ? (
          <div className="text-muted-foreground text-sm">
            Ingen CRM-brugere endnu. Opret via <em>Brugere</em> i menuen
            øverst til højre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3 font-bold">Navn</th>
                  <th className="py-2 pr-3 font-bold">E-mail</th>
                  <th className="py-2 pr-3 font-bold">Rolle</th>
                  <th className="py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(logins.data ?? []).map((row) => (
                  <RoleRow
                    key={row.id}
                    row={row}
                    saving={
                      mutation.isPending &&
                      mutation.variables?.salesId === row.id
                    }
                    onChange={(role) =>
                      mutation.mutate({ salesId: row.id, lago_role: role })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoleRow({
  row,
  saving,
  onChange,
}: {
  row: CrmLoginRow;
  saving: boolean;
  onChange: (role: LagoRole) => void;
}) {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "(uden navn)";
  const currentRole = (row.lago_role ?? "saelger") as LagoRole;
  return (
    <tr className="border-b last:border-b-0">
      {/* Brief-tilføjelse 16. sep 2026: navnet linker til brugerens
          side (/sales/{id}). Det er dér "Send invitation" og "Log ind
          som" lever — og der er ingen anden vej derhen end at kende
          id'et. Jonas skal sende tre invitationer på fredag; det skal
          ikke kræve et URL-opslag pr. bruger. */}
      <td className="py-2 pr-3 font-bold">
        <Link
          to={`/sales/${row.id}`}
          className="text-[var(--fg)] no-underline hover:underline"
        >
          {name}
        </Link>
      </td>
      <td className="py-2 pr-3 text-muted-foreground">{row.email ?? "—"}</td>
      <td className="py-2 pr-3">
        <Select
          value={currentRole}
          onValueChange={(v) => onChange(v as LagoRole)}
          disabled={saving}
        >
          <SelectTrigger className="h-9 min-w-[130px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as LagoRole[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2">
        {row.disabled ? (
          <StatusPill variant="grey">Deaktiveret</StatusPill>
        ) : row.administrator ? (
          <StatusPill variant="blue">Administrator</StatusPill>
        ) : (
          <span className="text-muted-foreground text-sm">Aktiv</span>
        )}
      </td>
    </tr>
  );
}
