import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Icon } from "@/lago/ui/Icon";

/**
 * Brief 25 (30. sep 2026): enhanced customer picker for the dashboard
 * action bar. Three sections before free search:
 *   1. Today's registrations (the customer you just visited)
 *   2. Planned visits (the next customer on your list)
 *   3. Free search over all your customers
 *
 * Two taps to register on a customer you just visited; five otherwise.
 */

export interface SelectedCompany {
  id: number;
  name: string;
  segment?: "A" | "B" | "C" | "X" | "L" | null;
}

interface DashboardKundePickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (company: SelectedCompany) => void;
  title: string;
  description?: string;
}

/** Company IDs that had a CRM-native activity registered today. */
async function fetchTodaysRegistrations(salesId: number): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseClient()
    .from("customer_activities_lago")
    .select("company_id")
    .eq("sales_id", salesId)
    .eq("activity_date", today)
    .is("deleted_at", null)
    .order("id", { ascending: false });
  if (error) throw error;
  // Deduplicate — one company may have multiple activities today.
  return [...new Set((data ?? []).map((r) => r.company_id as number))];
}

/** Company IDs with a planned visit today or in the future. */
async function fetchPlannedVisitCompanyIds(): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseClient()
    .from("companies_lago")
    .select("company_id")
    .not("next_visit_planned", "is", null)
    .gte("next_visit_planned", `${today}T00:00:00`)
    .order("next_visit_planned", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.company_id as number);
}

export function DashboardKundePicker({
  open,
  onOpenChange,
  onSelect,
  title,
  description,
}: DashboardKundePickerProps) {
  const mySalesId = useViewSalesId();
  const [q, setQ] = useState("");

  // All of the salesperson's customers.
  const allQuery = useQuery({
    queryKey: ["lago-dashboard-action-kunder", mySalesId],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: open && mySalesId != null,
    staleTime: 60_000,
  });

  // Today's registrations (company IDs only).
  const todayQuery = useQuery({
    queryKey: ["lago-dashboard-today-reg", mySalesId],
    queryFn: () => fetchTodaysRegistrations(mySalesId!),
    enabled: open && mySalesId != null,
    staleTime: 30_000,
  });

  // Planned visits (company IDs only).
  const plannedQuery = useQuery({
    queryKey: ["lago-dashboard-planned-visits", mySalesId],
    queryFn: () => fetchPlannedVisitCompanyIds(),
    enabled: open,
    staleTime: 30_000,
  });

  const { todayRows, plannedRows, searchRows } = useMemo(() => {
    const rows = allQuery.data ?? [];
    const todayIds = new Set(todayQuery.data ?? []);
    const plannedIds = new Set(plannedQuery.data ?? []);
    const needle = q.trim().toLowerCase();

    if (needle) {
      // Free search mode — flat list, no sections.
      const matched = rows
        .filter((r) => {
          const hay = [r.name, r.city ?? ""].join(" ").toLowerCase();
          return hay.includes(needle);
        })
        .slice(0, 20);
      return { todayRows: [], plannedRows: [], searchRows: matched };
    }

    // Sectioned mode: today, planned, then nothing (search to see all).
    const today = rows.filter((r) => todayIds.has(r.id));
    const planned = rows.filter(
      (r) => plannedIds.has(r.id) && !todayIds.has(r.id),
    );
    return { todayRows: today, plannedRows: planned, searchRows: [] };
  }, [allQuery.data, todayQuery.data, plannedQuery.data, q]);

  const isPending =
    allQuery.isPending || todayQuery.isPending || plannedQuery.isPending;
  const hasAnySection =
    todayRows.length > 0 || plannedRows.length > 0 || searchRows.length > 0;

  const handleSelect = (row: {
    id: number;
    name: string;
    extension?: { segment?: "A" | "B" | "C" | "X" | "L" | null };
  }) => {
    onSelect({
      id: row.id,
      name: row.name,
      segment: row.extension?.segment ?? null,
    });
    onOpenChange(false);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="border-b border-[var(--line)] px-6 pt-1 pb-3">
          <div className="relative">
            <Icon
              icon={Search}
              size="sm"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--fg-3)]"
            />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kundenavn eller by"
              className="pl-9"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Icon icon={Loader2} className="animate-spin" />
              Henter kunder …
            </div>
          ) : !hasAnySection && !q.trim() ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Begynd at skrive for at søge.
            </p>
          ) : !hasAnySection && q.trim() ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Ingen kunder matcher søgningen.
            </p>
          ) : (
            <div className="flex flex-col">
              {todayRows.length > 0 && (
                <Section label="Dagens registreringer">
                  {todayRows.map((row) => (
                    <PickerRow key={row.id} row={row} onSelect={handleSelect} />
                  ))}
                </Section>
              )}
              {plannedRows.length > 0 && (
                <Section label="Planlagte besøg">
                  {plannedRows.map((row) => (
                    <PickerRow key={row.id} row={row} onSelect={handleSelect} />
                  ))}
                </Section>
              )}
              {searchRows.length > 0 && (
                <ul className="flex flex-col">
                  {searchRows.map((row) => (
                    <PickerRow key={row.id} row={row} onSelect={handleSelect} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-4 pt-2 pb-1 text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
        {label}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function PickerRow({
  row,
  onSelect,
}: {
  row: { id: number; name: string; city?: string | null };
  onSelect: (row: { id: number; name: string }) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row)}
        className="flex w-full min-h-11 items-baseline gap-3 rounded-md px-4 py-2 text-left hover:bg-[var(--surface-1)]"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">
          {row.name}
        </span>
        {row.city && (
          <span className="shrink-0 text-[13px] text-[var(--fg-3)]">
            {row.city}
          </span>
        )}
      </button>
    </li>
  );
}
