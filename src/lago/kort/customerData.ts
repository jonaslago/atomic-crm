import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import type { CustomerListRow } from "@/lago/customers/dataAccess";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import {
  resolveVisitPriority,
  type IntervalsConfig,
  type VisitPriority,
} from "@/lago/customers/priority";

/**
 * A customer as the felt-flade wants to render it — the master row from
 * companies + companies_lago plus a single note-quote pulled from the
 * most recent customer activity (brief 9). Also includes phone_number
 * for the 📞 quick-action so the row is self-sufficient.
 */
export interface FeltCustomer {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  zipcode: string | null;
  sales_id: number | null;
  phone_number: string | null;
  extension: CustomerListRow["extension"];
  priority: VisitPriority;
  latestActivityDate: string | null;
  latestActivityType: string | null;
  latestActivityDescription: string | null;
  latestActivitySales: string | null;
}

interface LatestActivityRow {
  company_id: number;
  activity_date: string;
  activity_type: string | null;
  description: string | null;
  sales_name: string | null;
}

interface CompanyRow {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  zipcode: string | null;
  sales_id: number | null;
  phone_number: string | null;
}

/**
 * Fetches the full customer list (used elsewhere in LAGO) and enriches
 * each row with the most recent activity for that company. Two queries,
 * merged client-side — keeps the code simple and lets React Query cache
 * both. Sales_id filtering ("mine kunder") happens server-side via the
 * existing fetchCustomerList opts.
 */
export async function fetchFeltCustomers(opts: {
  mySalesId?: number | null;
  onlyMine?: boolean;
  intervals?: IntervalsConfig;
  /** Brief 26 §2 (rev. 16. sep 2026): default false = kun aktive
   *  kunder. SoegPage/DagensPage sender filters.showInactive her, så
   *  Vis inaktive-toggle udløser refetch og felt-fladerne får inaktive
   *  kunder med i client-filteret. */
  includeInactive?: boolean;
}): Promise<FeltCustomer[]> {
  const list = await fetchCustomerList(opts);
  if (list.length === 0) return [];

  const supabase = getSupabaseClient();
  const ids = list.map((r) => r.id);

  const [phoneRes, activityRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, city, address, zipcode, sales_id, phone_number")
      .in("id", ids)
      .returns<CompanyRow[]>(),
    supabase
      .from("customer_activities_lago")
      .select("company_id, activity_date, activity_type, description, sales_name")
      .in("company_id", ids)
      // Skjul blødt slettede aktiviteter (brief 16. sep 2026).
      .is("deleted_at", null)
      .order("activity_date", { ascending: false })
      .returns<LatestActivityRow[]>(),
  ]);

  if (phoneRes.error) throw phoneRes.error;
  if (activityRes.error) throw activityRes.error;

  const phones = new Map<number, CompanyRow>();
  for (const c of phoneRes.data ?? []) phones.set(c.id, c);

  const firstActivity = new Map<number, LatestActivityRow>();
  for (const a of activityRes.data ?? []) {
    if (!firstActivity.has(a.company_id)) firstActivity.set(a.company_id, a);
  }

  return list.map((r) => {
    const priority = resolveVisitPriority(r.visit_priority);
    const activity = firstActivity.get(r.id);
    const phone = phones.get(r.id);
    return {
      id: r.id,
      name: r.name,
      city: r.city,
      address: phone?.address ?? null,
      zipcode: phone?.zipcode ?? null,
      sales_id: r.sales_id,
      phone_number: phone?.phone_number ?? null,
      extension: r.extension,
      priority,
      latestActivityDate: activity?.activity_date ?? null,
      latestActivityType: activity?.activity_type ?? null,
      latestActivityDescription: activity?.description ?? null,
      latestActivitySales: activity?.sales_name ?? null,
    };
  });
}

