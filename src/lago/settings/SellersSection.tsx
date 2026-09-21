import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Shield, ShieldOff, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";
import { StatusPill } from "@/lago/ui/StatusPill";

import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";
import {
  fetchCrmLogins,
  fetchLagoSellers,
  LastAdminError,
  updateLagoSeller,
  updateSalesAdministrator,
  updateSalesCodeMap,
  updateSalesLagoRole,
  type CrmLoginRow,
  type LagoSellerRow,
} from "./dataAccess";

const ROLE_LABEL: Record<LagoRole, string> = {
  saelger: "Sælger",
  kontor: "Kontor",
  ledelse: "Ledelse",
  admin: "Admin",
};

const NONE = "__none__";

/**
 * Sellers-tabellen: én kanonisk record per person, med badge for om de
 * har CRM-login. Admins kan slå aktiv/inaktiv til/fra og manuelt binde
 * en sælger til en Supabase-bruger hvis e-mail-matchet ikke fangede
 * dem ved seed-tid.
 */
export function SellersSection({ isAdmin }: { isAdmin: boolean }) {
  const translate = useTranslate();
  const qc = useQueryClient();
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;

  const sellers = useQuery({
    queryKey: ["lago-sellers"],
    queryFn: fetchLagoSellers,
  });

  // Loaded whenever the section renders — the "Admin"-column uses
  // logins.administrator to know a row's current admin state (that flag
  // lives on public.sales, not on lago_sellers, so the join happens
  // client-side).
  const logins = useQuery({
    queryKey: ["lago-crm-logins"],
    queryFn: fetchCrmLogins,
  });

  const adminBySalesId = new Map<number, boolean>();
  const roleBySalesId = new Map<number, LagoRole>();
  for (const l of logins.data ?? []) {
    adminBySalesId.set(l.id, !!l.administrator);
    if (l.lago_role) roleBySalesId.set(l.id, l.lago_role);
  }

  const mutation = useMutation({
    mutationFn: updateLagoSeller,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-sellers"] });
      qc.invalidateQueries({ queryKey: ["lago-sales-users"] });
      toast.success(translate("lago.settings.sellers.row_saved"));
    },
    onError: (err) =>
      toast.error(translate("lago.settings.sellers.save_failed"), {
        description: readErrorMessage(err),
      }),
  });

  // Brief 71 §2 leverance A (21. sep 2026): re-link (admin binder en
  // VISMA-sælger til en CRM-bruger) skrives til sales_code_map_lago.
  // Foer skrev vi til lago_sellers.sales_id — den kolonne læses ikke
  // længere noget sted (leverance B dropper den). Ellers drev de to
  // kilder fra hinanden i det øjeblik admin re-linkede én sælger.
  const mappingMutation = useMutation({
    mutationFn: updateSalesCodeMap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-sellers"] });
      qc.invalidateQueries({ queryKey: ["lago-sales-code-map"] });
      qc.invalidateQueries({ queryKey: ["lago-current-seller-code"] });
      toast.success(translate("lago.settings.sellers.row_saved"));
    },
    onError: (err) =>
      toast.error(translate("lago.settings.sellers.save_failed"), {
        description: readErrorMessage(err),
      }),
  });

  const adminMutation = useMutation({
    mutationFn: updateSalesAdministrator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-crm-logins"] });
      qc.invalidateQueries({ queryKey: ["lago-admin-flag"] });
      toast.success(translate("lago.settings.sellers.admin_saved"));
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

  const toggleAdmin = (row: LagoSellerRow, currentlyAdmin: boolean) => {
    if (row.sales_id == null) return;
    adminMutation.mutate({
      salesId: row.sales_id,
      administrator: !currentlyAdmin,
    });
  };

  const roleMutation = useMutation({
    mutationFn: updateSalesLagoRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-crm-logins"] });
      qc.invalidateQueries({ queryKey: ["lago-admin-flag"] });
      qc.invalidateQueries({ queryKey: ["lago-current-role"] });
      toast.success(
        translate("lago.settings.sellers.role_saved", { _: "Rolle gemt" }),
      );
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

  const setRole = (row: LagoSellerRow, role: LagoRole) => {
    if (row.sales_id == null) return;
    roleMutation.mutate({ salesId: row.sales_id, lago_role: role });
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSalesKey, setEditSalesKey] = useState<string>(NONE);

  const beginEdit = (row: LagoSellerRow) => {
    setEditingId(row.id);
    setEditSalesKey(row.sales_id != null ? String(row.sales_id) : NONE);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditSalesKey(NONE);
  };
  const saveMapping = (row: LagoSellerRow) => {
    const salesId = editSalesKey === NONE ? null : Number(editSalesKey);
    // Brief 71 §2 leverance A: skriv til sales_code_map_lago via
    // visma_sales_code (mapping-tabellens primary key), IKKE til
    // lago_sellers.sales_id (som droppes i leverance B).
    mappingMutation.mutate(
      {
        visma_sales_code: row.visma_sales_code,
        crm_sales_id: salesId,
        updated_by: currentSalesId,
      },
      { onSuccess: cancelEdit },
    );
  };

  const data = sellers.data ?? [];
  const total = data.length;
  const activeCount = data.filter((s) => s.active).length;
  const linkedCount = data.filter((s) => s.sales_id != null).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardTitle className="text-lg">
            {translate("lago.settings.sellers.section_title")}
          </CardTitle>
          <span className="text-muted-foreground text-sm">
            {translate("lago.settings.sellers.active_count", {
              active: activeCount,
              total,
              linked: linkedCount,
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {translate("lago.settings.sellers.section_body")}
        </p>
      </CardHeader>
      <CardContent>
        {sellers.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Icon icon={Loader2} className="animate-spin" /> …
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_full_name")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_email")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_initials")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_code")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_active")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_login")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_admin")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {translate("lago.settings.sellers.header_role", {
                      _: "Rolle",
                    })}
                  </th>
                  {isAdmin && (
                    <th className="py-2 pr-3 font-medium sr-only">Handling</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b last:border-b-0",
                        !row.active && "text-muted-foreground",
                      )}
                    >
                      <td className="py-2 pr-3 font-medium">{row.full_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-sm">
                        {row.email ?? "—"}
                      </td>
                      <td className="py-2 pr-3">{row.initials ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono text-sm">
                        {row.visma_sales_code}
                      </td>
                      <td className="py-2 pr-3">
                        {isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-6 px-2 text-sm",
                              row.active
                                ? "text-[var(--st-green-fg)]"
                                : "text-[var(--fg-3)]",
                            )}
                            onClick={() =>
                              mutation.mutate({
                                id: row.id,
                                active: !row.active,
                              })
                            }
                            title={translate(
                              "lago.settings.sellers.toggle_active",
                            )}
                          >
                            {row.active ? (
                              <Icon icon={Check} size="sm" className="mr-1" />
                            ) : (
                              <Icon icon={X} size="sm" className="mr-1" />
                            )}
                            {row.active ? "Aktiv" : "Inaktiv"}
                          </Button>
                        ) : row.active ? (
                          <StatusPill variant="green">Aktiv</StatusPill>
                        ) : (
                          <StatusPill variant="grey">Inaktiv</StatusPill>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing && isAdmin ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={editSalesKey}
                              onValueChange={setEditSalesKey}
                            >
                              <SelectTrigger className="h-7 min-w-[220px] text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>
                                  {translate(
                                    "lago.settings.sellers.no_login_option",
                                  )}
                                </SelectItem>
                                {(logins.data ?? []).map((l) => (
                                  <SelectItem key={l.id} value={String(l.id)}>
                                    {(l.first_name ?? "") +
                                      " " +
                                      (l.last_name ?? "")}
                                    {l.email ? ` · ${l.email}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-sm"
                              onClick={() => saveMapping(row)}
                              disabled={mutation.isPending}
                            >
                              {mutation.isPending ? (
                                <Icon
                                  icon={Loader2}
                                  size="sm"
                                  className="animate-spin"
                                />
                              ) : (
                                <Icon icon={Check} size="sm" />
                              )}
                              Gem
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-sm"
                              onClick={cancelEdit}
                            >
                              {translate("lago.settings.sellers.cancel")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {row.sales_id != null ? (
                              <StatusPill variant="green">
                                <Icon icon={Check} size="sm" />
                                {translate("lago.settings.sellers.has_login")}
                                {row.sales_email && (
                                  <span className="ml-1 text-sm font-normal">
                                    · {row.sales_email}
                                  </span>
                                )}
                              </StatusPill>
                            ) : (
                              <StatusPill variant="grey">
                                <Icon icon={X} size="sm" />
                                {translate("lago.settings.sellers.no_login")}
                              </StatusPill>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-sm"
                                onClick={() => beginEdit(row)}
                              >
                                {translate("lago.settings.sellers.map_login")}
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <AdminCell
                          row={row}
                          currentlyAdmin={
                            row.sales_id != null
                              ? !!adminBySalesId.get(row.sales_id)
                              : false
                          }
                          isAdminUser={isAdmin}
                          saving={
                            adminMutation.isPending &&
                            adminMutation.variables?.salesId === row.sales_id
                          }
                          onToggle={toggleAdmin}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <RoleCell
                          row={row}
                          currentRole={
                            row.sales_id != null
                              ? (roleBySalesId.get(row.sales_id) ?? "saelger")
                              : null
                          }
                          isAdminUser={isAdmin}
                          saving={
                            roleMutation.isPending &&
                            roleMutation.variables?.salesId === row.sales_id
                          }
                          onChange={setRole}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AdminCellProps {
  row: LagoSellerRow;
  currentlyAdmin: boolean;
  isAdminUser: boolean;
  saving: boolean;
  onToggle: (row: LagoSellerRow, currentlyAdmin: boolean) => void;
}

/** The Admin cell renders:
 *  - "—" (muted) when the seller has no CRM login (no sales.administrator to flip)
 *  - A pill-badge showing the current admin state, non-admins see it as read-only
 *  - Admins get a toggle button that flips public.sales.administrator. */
function AdminCell({
  row,
  currentlyAdmin,
  isAdminUser,
  saving,
  onToggle,
}: AdminCellProps) {
  const translate = useTranslate();

  if (row.sales_id == null) {
    return (
      <span className="text-muted-foreground text-sm italic">
        {translate("lago.settings.sellers.no_login_dash")}
      </span>
    );
  }

  if (!isAdminUser) {
    return currentlyAdmin ? (
      <StatusPill variant="blue">
        <Icon icon={Shield} size="sm" />
        {translate("lago.settings.sellers.is_admin")}
      </StatusPill>
    ) : (
      <StatusPill variant="grey">
        {translate("lago.settings.sellers.not_admin")}
      </StatusPill>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 px-2 text-sm",
        currentlyAdmin ? "text-[var(--st-amber-fg)]" : "text-[var(--fg-3)]",
      )}
      onClick={() => onToggle(row, currentlyAdmin)}
      disabled={saving}
      title={translate("lago.settings.sellers.toggle_admin")}
    >
      {saving ? (
        <Icon icon={Loader2} size="sm" className="mr-1 animate-spin" />
      ) : currentlyAdmin ? (
        <Icon icon={Shield} size="sm" className="mr-1" />
      ) : (
        <Icon icon={ShieldOff} size="sm" className="mr-1" />
      )}
      {currentlyAdmin
        ? translate("lago.settings.sellers.is_admin")
        : translate("lago.settings.sellers.not_admin")}
    </Button>
  );
}

interface RoleCellProps {
  row: LagoSellerRow;
  currentRole: LagoRole | null; // null = ingen CRM-login
  isAdminUser: boolean;
  saving: boolean;
  onChange: (row: LagoSellerRow, role: LagoRole) => void;
}

/** RoleCell: rulle-felt til lago_role. Kun admin kan ændre.
 *  Sælger uden CRM-login vises som "—" (ingen rolle at sætte). */
function RoleCell({
  row,
  currentRole,
  isAdminUser,
  saving,
  onChange,
}: RoleCellProps) {
  if (row.sales_id == null || currentRole == null) {
    return <span className="text-muted-foreground text-sm italic">—</span>;
  }

  if (!isAdminUser) {
    return (
      <StatusPill variant={currentRole === "admin" ? "blue" : "grey"}>
        {ROLE_LABEL[currentRole]}
      </StatusPill>
    );
  }

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => onChange(row, v as LagoRole)}
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
  );
}

// Keeps TS happy if the interface goes stale in later refactors.
export type { CrmLoginRow };
