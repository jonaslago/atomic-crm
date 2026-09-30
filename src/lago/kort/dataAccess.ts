import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import type { CustomerListRow } from "@/lago/customers/dataAccess";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import type { IntervalsConfig } from "@/lago/customers/priority";
import { resolveVisitPriority } from "@/lago/customers/priority";

import type { FeltCustomer } from "./customerData";

interface GeoRow {
  company_id: number;
  lat: number;
  lng: number;
}

interface CompanyRow {
  id: number;
  address: string | null;
  zipcode: string | null;
  phone_number: string | null;
}

/**
 * Domain-brief 12 · Fase C — feed for the kort-flade. Combines the raw
 * customer list with the geokodede koordinater on companies_lago +
 * derives priority via the shared computeVisitPriority.
 *
 * Brief 14 (rettelse 2): returnerer ALLE kunder (også dem uden koord),
 * så kortets counts matcher Dagens 1:1. Pins uden koord tegnes ikke —
 * `_lat/_lng` bliver undefined og `coordsOf()` returnerer null.
 */
export async function fetchKortCustomers(opts: {
  mySalesId?: number | null;
  onlyMine?: boolean;
  intervals?: IntervalsConfig;
  /** Brief 26 §2 (rev. 16. sep 2026): default false = kun aktive. */
  includeInactive?: boolean;
}): Promise<FeltCustomer[]> {
  const list = await fetchCustomerList(opts);
  if (list.length === 0) return [];

  const supabase = getSupabaseClient();
  const ids = list.map((r) => r.id);

  const [geoRes, phoneRes] = await Promise.all([
    supabase
      .from("companies_lago")
      .select("company_id, lat, lng")
      .in("company_id", ids)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .returns<GeoRow[]>(),
    supabase
      .from("companies")
      .select("id, address, zipcode, phone_number")
      .in("id", ids)
      .returns<CompanyRow[]>(),
  ]);
  if (geoRes.error) throw geoRes.error;
  if (phoneRes.error) throw phoneRes.error;

  const coordByCompany = new Map<number, GeoRow>();
  for (const g of geoRes.data ?? []) coordByCompany.set(g.company_id, g);

  const phoneByCompany = new Map<number, CompanyRow>();
  for (const c of phoneRes.data ?? []) phoneByCompany.set(c.id, c);

  const out: FeltCustomer[] = [];
  for (const r of list) {
    const geo = coordByCompany.get(r.id);
    const phone = phoneByCompany.get(r.id);
    const baseExt =
      r.extension ?? {
        visma_customer_no: null,
        segment: null,
        last_visit_at: null,
        next_visit_planned: null,
        distrikt: null,
        visma_sales_code: null,
        visma_sales_name: null,
        kundestatus: null,
        is_active: true,
      };
    // We piggyback the coords onto extension so KortPage's coordsOf helper
    // can read them without a parallel lookup map — the FeltCustomer type
    // stays baglængs-kompatibel because the extra keys are optional.
    // Kunder uden koord får extension uden `_lat/_lng` → ingen pin, men
    // stadig med i counts (brief 14 rev 2).
    const extWithCoords = geo
      ? ({
          ...baseExt,
          _lat: geo.lat,
          _lng: geo.lng,
        } as unknown as CustomerListRow["extension"])
      : baseExt;
    out.push({
      id: r.id,
      name: r.name,
      city: r.city,
      address: phone?.address ?? null,
      zipcode: phone?.zipcode ?? null,
      sales_id: r.sales_id,
      phone_number: phone?.phone_number ?? null,
      extension: extWithCoords,
      priority: resolveVisitPriority(r.visit_priority),
      latestActivityDate: null,
      latestActivityType: null,
      latestActivityDescription: null,
      latestActivitySales: null,
    });
  }
  return out;
}
