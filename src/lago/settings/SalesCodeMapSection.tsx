import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";
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

import {
  fetchCrmLogins,
  fetchSalesCodeMap,
  runDeriveSalesIdFromVisma,
  updateSalesCodeMap,
  type CrmLoginRow,
  type SalesCodeMapRow,
} from "./dataAccess";

const NONE = "__none__";

/**
 * Brief 24 · sales_code_map_lago i Indstillinger.
 *
 * Én kanonisk mapping fra VISMA-sælgerkode → CRM-bruger. Redigeres kun
 * her, aldrig i migrationer (koderne ændrer sig når der kommer en ny
 * sælger). Systemkoder (98 Webshop, 99 System, 999 Ingen sælger) er
 * permanent låst til crm_sales_id = NULL og vises gråt.
 *
 * NB: to nummersystemer som overlapper — VISMA-kode 1 = Ole Andreasen,
 * CRM sales_id 1 = Jonas Arild. Se skema-kommentar i
 * 20260915120000_lago_24_sales_code_map.sql.
 *
 * "Kør derive nu"-knap kalder derive_sales_id_from_visma() der er
 * single source of truth for hvordan companies.sales_id afledes.
 * Bruges også af nulstillingsproceduren (som sidste skridt).
 */
export function SalesCodeMapSection({ isAdmin }: { isAdmin: boolean }) {
  const translate = useTranslate();
  const qc = useQueryClient();
  const { data: identity } = useGetIdentity();
  const currentSalesId = typeof identity?.id === "number" ? identity.id : null;

  const mapping = useQuery({
    queryKey: ["lago-sales-code-map"],
    queryFn: fetchSalesCodeMap,
  });

  const logins = useQuery({
    queryKey: ["lago-crm-logins"],
    queryFn: fetchCrmLogins,
  });

  const updateMutation = useMutation({
    mutationFn: updateSalesCodeMap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-sales-code-map"] });
      toast.success(
        translate("lago.settings.sales_code_map.saved", {
          _: "Mapping opdateret",
        }),
      );
    },
    onError: (err) =>
      toast.error(
        translate("lago.settings.sales_code_map.save_failed", {
          _: "Kunne ikke gemme",
        }),
        { description: readErrorMessage(err) },
      ),
  });

  const deriveMutation = useMutation({
    mutationFn: runDeriveSalesIdFromVisma,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["lago-customer-list"] });
      qc.invalidateQueries({ queryKey: ["lago-felt-customers"] });
      // Brief 24: completeness-format. Alle rækker skal være gjort
      // rede for. Bryder invarianten, viser vi det som en advarsel —
      // ingen behøver at slå op i basen for at se det.
      const title = translate("lago.settings.sales_code_map.derived_summary", {
        total: result.total,
        updated: result.updated,
        system: result.system_code_null,
        skipped: result.skipped_null_code,
        unchanged: result.ok_no_change,
        _: `${result.total} kunder gennemgået · ${result.updated} fik ny ejer · ${result.system_code_null} uden sælger (kode 999) · ${result.skipped_null_code} uden VISMA-kode · ${result.ok_no_change} uændret`,
      });
      if (result.invariant_holds) {
        toast.success(title, { duration: 10000 });
      } else {
        toast.warning(title, {
          description: translate(
            "lago.settings.sales_code_map.invariant_broken",
            {
              _: "⚠️ Summen går ikke op til antal kunder. Kontakt CRM-Lead før nulstillingsproceduren fortsætter.",
            },
          ),
          duration: 60000,
        });
      }
    },
    onError: (err) =>
      toast.error(
        translate("lago.settings.sales_code_map.derive_failed", {
          _: "Afledning fejlede",
        }),
        { description: readErrorMessage(err) },
      ),
  });

  const setMapping = (visma_sales_code: string, next: string) => {
    updateMutation.mutate({
      visma_sales_code,
      crm_sales_id: next === NONE ? null : Number(next),
      updated_by: currentSalesId,
    });
  };

  const isLoading = mapping.isLoading || logins.isLoading;
  const rows = mapping.data ?? [];
  const availableLogins = (logins.data ?? []).filter((l) => !l.disabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-bold">
          {translate("lago.settings.sales_code_map.title", {
            _: "Ejerskab: VISMA-kode → CRM-bruger",
          })}
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          {translate("lago.settings.sales_code_map.subtitle", {
            _: "Én kanonisk mapping. companies.sales_id afledes af denne tabel ved hver VISMA-import (og manuelt via knappen nedenfor). VISMA-nummersystem og CRM-nummersystem overlapper — vær opmærksom.",
          })}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Icon icon={Loader2} className="animate-spin" />
            {translate("lago.settings.loading", { _: "Henter …" })}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-bold uppercase tracking-wide">
                    <th className="py-2 pr-3 text-left">VISMA-kode</th>
                    <th className="py-2 pr-3 text-left">Navn i VISMA</th>
                    <th className="py-2 pr-3 text-left">
                      CRM-bruger (sales_id)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <MapRow
                      key={r.visma_sales_code}
                      row={r}
                      logins={availableLogins}
                      isAdmin={isAdmin}
                      onChange={(next) => setMapping(r.visma_sales_code, next)}
                      saving={updateMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-muted mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground max-w-md text-sm">
                {translate("lago.settings.sales_code_map.derive_hint", {
                  _: "Kør normalt automatisk som sidste skridt i kunde- og aktivitetsimporten. Kun nødvendigt manuelt hvis mappingen ovenfor er ændret uden for importen.",
                })}
              </p>
              <Button
                type="button"
                onClick={() => deriveMutation.mutate()}
                disabled={!isAdmin || deriveMutation.isPending}
                className="min-h-11 gap-1.5"
              >
                {deriveMutation.isPending ? (
                  <Icon icon={Loader2} className="animate-spin" />
                ) : (
                  <Icon icon={Play} size="sm" />
                )}
                {translate("lago.settings.sales_code_map.run_derive", {
                  _: "Afled ejerskab nu",
                })}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MapRow({
  row,
  logins,
  isAdmin,
  onChange,
  saving,
}: {
  row: SalesCodeMapRow;
  logins: CrmLoginRow[];
  isAdmin: boolean;
  onChange: (next: string) => void;
  saving: boolean;
}) {
  const value = row.crm_sales_id == null ? NONE : String(row.crm_sales_id);
  const locked = !row.is_person; // 98/99/999 må aldrig kobles til en bruger
  return (
    <tr className={cn("border-b last:border-0", locked && "opacity-60")}>
      <td className="py-3 pr-3 tabular-nums font-bold">
        {row.visma_sales_code}
      </td>
      <td className="py-3 pr-3">{row.label}</td>
      <td className="py-3 pr-3">
        {locked ? (
          <span className="text-muted-foreground text-sm italic">
            Ikke en menneskelig bruger — permanent null
          </span>
        ) : (
          <Select
            value={value}
            onValueChange={onChange}
            disabled={!isAdmin || saving}
          >
            <SelectTrigger className="h-9 w-full text-sm sm:w-[280px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— (ikke koblet)</SelectItem>
              {logins.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.first_name} {l.last_name} · sales_id {l.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
    </tr>
  );
}
