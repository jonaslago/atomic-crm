// Domain-brief 27 §4 · Revisionsspor.
//
// Simpel liste under Indstillinger — hvem, som hvem, hvornår startet,
// hvornår afsluttet, hvordan afsluttet. Kun admin kan læse (RLS
// håndhæver det på impersonation_log_lago).

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";

interface LogRow {
  id: number;
  admin_sales_id: number | null;
  target_sales_id: number | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: "manual" | "expired" | "unknown" | null;
  admin_sales: { first_name: string | null; last_name: string | null } | null;
  target_sales: { first_name: string | null; last_name: string | null } | null;
}

const dtFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fullName(
  s: { first_name: string | null; last_name: string | null } | null,
): string {
  if (!s) return "—";
  return (
    [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "(ukendt)"
  );
}

const IMPERSON_TTL_MS = 30 * 60 * 1000;

function reasonLabel(
  reason: LogRow["ended_reason"],
  endedAt: string | null,
  startedAt: string,
): string {
  if (endedAt) {
    switch (reason) {
      case "manual":
        return "Afsluttet manuelt";
      case "expired":
        return "Udløbet";
      case "unknown":
        return "Ukendt";
      default:
        return "Afsluttet";
    }
  }
  // Forældreløs række: klienten nåede aldrig at kalde
  // end_impersonation (fanen lukket, browser crashede, netværk faldt
  // ud). Spærringen selv rettede sig efter 30 min via guard-triggerens
  // tidsvindue, men rækken står stadig teknisk "åben". Vis den ærligt
  // som udløbet — et revisionsspor man ikke kan læse i øjenhøjde,
  // holder folk op med at åbne. Ingen oprydning i data.
  const ageMs = Date.now() - new Date(startedAt).getTime();
  if (ageMs > IMPERSON_TTL_MS) return "Udløbet (fanen lukket)";
  return "Aktiv";
}

async function fetchLog(): Promise<LogRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("impersonation_log_lago")
    .select(
      "id, admin_sales_id, target_sales_id, started_at, ended_at, ended_reason, admin_sales:sales!admin_sales_id(first_name,last_name), target_sales:sales!target_sales_id(first_name,last_name)",
    )
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  // PostgREST kan returnere joins som array eller objekt afhængigt af
  // relation-shape — flatt til objekt.
  return (data ?? []).map((r: any) => ({
    ...r,
    admin_sales: Array.isArray(r.admin_sales)
      ? r.admin_sales[0] ?? null
      : r.admin_sales,
    target_sales: Array.isArray(r.target_sales)
      ? r.target_sales[0] ?? null
      : r.target_sales,
  })) as LogRow[];
}

interface Props {
  isAdmin: boolean;
}

export function ImpersonationLogSection({ isAdmin }: Props) {
  const query = useQuery({
    queryKey: ["lago-impersonation-log"],
    queryFn: fetchLog,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={ShieldAlert} className="text-[var(--st-red-fg)]" />
          "Log ind som" — revisionsspor
        </CardTitle>
        <CardDescription>
          De 50 seneste sessioner. Rækken skrives når sessionen udleveres —
          et nedbrud undervejs fjerner ikke sporet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <p className="text-muted-foreground text-sm">Henter …</p>
        ) : query.error ? (
          <p className="text-destructive text-sm">
            Kunne ikke hente revisionssporet.
          </p>
        ) : !query.data || query.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ingen sessioner endnu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr className="border-b">
                  <th className="py-2 text-left font-bold">Admin</th>
                  <th className="py-2 text-left font-bold">Som</th>
                  <th className="py-2 text-left font-bold">Startet</th>
                  <th className="py-2 text-left font-bold">Afsluttet</th>
                  <th className="py-2 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2">{fullName(r.admin_sales)}</td>
                    <td className="py-2">{fullName(r.target_sales)}</td>
                    <td className="py-2 tabular-nums">
                      {dtFmt.format(new Date(r.started_at))}
                    </td>
                    <td className="py-2 tabular-nums">
                      {r.ended_at
                        ? dtFmt.format(new Date(r.ended_at))
                        : "—"}
                    </td>
                    <td className="py-2">
                      {reasonLabel(r.ended_reason, r.ended_at, r.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
