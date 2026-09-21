import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type { IntervalsConfig } from "@/lago/customers/priority";
import { DEFAULT_INTERVALS_CONFIG } from "@/lago/customers/priority";
import { readEdgeFunctionError } from "@/lago/ui/errorMessage";

// ---------------------------------------------------------------------
// Settings — visit intervals (SEG-3)
// ---------------------------------------------------------------------

export const VISIT_INTERVALS_KEY = "visit_intervals";

interface SettingsRow {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: number | null;
}

function normaliseIntervals(raw: unknown): IntervalsConfig {
  const fallback = DEFAULT_INTERVALS_CONFIG;
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d;
  const ratio = (v: unknown) =>
    typeof v === "number" && v > 0 && v <= 1 ? v : fallback.soonRatio;
  return {
    intervalDays: {
      A: num(obj.A, fallback.intervalDays.A),
      B: num(obj.B, fallback.intervalDays.B),
      C: num(obj.C, fallback.intervalDays.C),
    },
    soonRatio: ratio(obj.soonRatio),
  };
}

/** Fetch the current visit-interval config from DB, with the compile-time
 *  defaults as safe fallback when the row is missing or the JSON is not
 *  shaped like `IntervalsConfig`. */
export async function fetchVisitIntervals(): Promise<IntervalsConfig> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("lago_settings")
    .select("value")
    .eq("key", VISIT_INTERVALS_KEY)
    .maybeSingle<Pick<SettingsRow, "value">>();
  if (error) throw error;
  return normaliseIntervals(data?.value);
}

/** Upsert the visit-interval config. Admin-gated by RLS.
 *  Brief 73 §1a (21. sep 2026): updated_by skal med. Fra 29. sep kan syv
 *  mennesker ændre indstillinger; "hvem satte C til 90 dage?" har brug
 *  for et svar. Callers henter identity via useGetIdentity(). */
export async function saveVisitIntervals(
  config: IntervalsConfig,
  updatedBy: number | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const payload = {
    A: config.intervalDays.A,
    B: config.intervalDays.B,
    C: config.intervalDays.C,
    soonRatio: config.soonRatio,
  };
  const { error } = await supabase.from("lago_settings").upsert(
    {
      key: VISIT_INTERVALS_KEY,
      value: payload,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Sellers — kanonisk sælger-/brugerliste
// ---------------------------------------------------------------------

export interface LagoSellerRow {
  id: number;
  visma_sales_code: string;
  full_name: string;
  email: string | null;
  initials: string | null;
  title: string | null;
  active: boolean;
  sales_id: number | null;
  sales_email?: string | null;
}

export async function fetchLagoSellers(): Promise<LagoSellerRow[]> {
  const supabase = getSupabaseClient();
  // Brief 71 §2 leverance A (21. sep 2026): kobling sælger→CRM-bruger
  // læses fra sales_code_map_lago.crm_sales_id, ikke lago_sellers.sales_id.
  // Interface-feltet `sales_id` bevares — vi fylder det bare fra scm.
  // Tørkørsel 21. sep: 0 afvigelser mellem de to kolonner. Kolonnen på
  // lago_sellers droppes i leverance B efter torsdags-verifikation.
  const [sellersRes, mapRes] = await Promise.all([
    supabase
      .from("lago_sellers")
      .select("id, visma_sales_code, full_name, email, initials, title, active")
      .order("full_name", { ascending: true }),
    supabase
      .from("sales_code_map_lago")
      .select("visma_sales_code, crm_sales_id, sales:crm_sales_id(email)"),
  ]);
  if (sellersRes.error) throw sellersRes.error;
  if (mapRes.error) throw mapRes.error;

  const mapByCode = new Map<
    string,
    { crm_sales_id: number | null; sales_email: string | null }
  >();
  for (const m of (mapRes.data ?? []) as any[]) {
    const embed = Array.isArray(m.sales) ? m.sales[0] : m.sales;
    mapByCode.set(m.visma_sales_code, {
      crm_sales_id: m.crm_sales_id ?? null,
      sales_email: embed?.email ?? null,
    });
  }

  return (sellersRes.data ?? []).map((row: any) => {
    const m = mapByCode.get(row.visma_sales_code);
    return {
      id: row.id,
      visma_sales_code: row.visma_sales_code,
      full_name: row.full_name,
      email: row.email,
      initials: row.initials,
      title: row.title,
      active: !!row.active,
      sales_id: m?.crm_sales_id ?? null,
      sales_email: m?.sales_email ?? null,
    };
  });
}

export interface UpdateSellerInput {
  id: number;
  full_name?: string;
  email?: string | null;
  initials?: string | null;
  title?: string | null;
  active?: boolean;
  sales_id?: number | null;
}

export async function updateLagoSeller(
  input: UpdateSellerInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(input)) {
    if (k === "id") continue;
    patch[k] = v;
  }
  const { error } = await supabase
    .from("lago_sellers")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

/** Fetch available CRM logins (public.sales) so admins can manually
 *  re-link a sælger when e-mail didn't match at seed time. Also exposes
 *  the `administrator` flag so the sellers-list can render the admin
 *  toggle without a second round-trip. */
import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";

export interface CrmLoginRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  disabled: boolean | null;
  administrator: boolean | null;
  lago_role: LagoRole | null;
}

export async function fetchCrmLogins(): Promise<CrmLoginRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, first_name, last_name, email, disabled, administrator, lago_role",
    )
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrmLoginRow[];
}

// ---------------------------------------------------------------------
// LAGO role (public.sales.lago_role)
// ---------------------------------------------------------------------

/** Set the LAGO role for a sales user. The DB trigger
 *  `sync_lago_role_to_administrator` keeps `administrator` in sync when
 *  role is promoted to / demoted from 'admin' — so we don't need to
 *  touch that flag here. RLS gates the write to admins.
 *
 *  Guardrail: if we're demoting the last active admin, refuse — same
 *  lockout protection as updateSalesAdministrator. */
export async function updateSalesLagoRole(input: {
  salesId: number;
  lago_role: LagoRole;
}): Promise<void> {
  if (input.lago_role !== "admin") {
    // Er brugeren i forvejen admin, og er de den sidste? Så nej.
    const supabase = getSupabaseClient();
    const { data: current } = await supabase
      .from("sales")
      .select("lago_role")
      .eq("id", input.salesId)
      .maybeSingle<{ lago_role: LagoRole | null }>();
    if (current?.lago_role === "admin") {
      const active = await countActiveAdmins();
      if (active <= 1) throw new LastAdminError();
    }
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("sales")
    .update({ lago_role: input.lago_role })
    .eq("id", input.salesId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Admin toggle (public.sales.administrator)
// ---------------------------------------------------------------------

/** Count active (non-disabled) admins — used to prevent lockout when an
 *  admin tries to demote the last remaining admin. Kept as a fresh
 *  server-side count so a stale local cache can't fool the guard. */
export async function countActiveAdmins(): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("sales")
    .select("id", { head: true, count: "exact" })
    .eq("administrator", true)
    .eq("disabled", false);
  if (error) throw error;
  return count ?? 0;
}

export class LastAdminError extends Error {
  constructor() {
    super("Cannot remove the last administrator");
    this.name = "LastAdminError";
  }
}

export async function updateSalesAdministrator(input: {
  salesId: number;
  administrator: boolean;
}): Promise<void> {
  if (!input.administrator) {
    // Guardrail: refuse to drop the last active admin.
    const active = await countActiveAdmins();
    if (active <= 1) throw new LastAdminError();
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("sales")
    .update({ administrator: input.administrator })
    .eq("id", input.salesId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// sales_code_map_lago — mapping VISMA-kode → CRM-bruger (Brief 24)
// ---------------------------------------------------------------------

export interface SalesCodeMapRow {
  visma_sales_code: string;
  crm_sales_id: number | null;
  label: string;
  is_person: boolean;
}

export async function fetchSalesCodeMap(): Promise<SalesCodeMapRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sales_code_map_lago")
    .select("visma_sales_code, crm_sales_id, label, is_person");
  if (error) throw error;
  // Numerisk sortering på VISMA-koden, ikke tekst-sortering
  // (10 hører til efter 8, ikke mellem 1 og 2).
  return (data ?? []).sort(
    (a, b) => Number(a.visma_sales_code) - Number(b.visma_sales_code),
  ) as SalesCodeMapRow[];
}

export async function updateSalesCodeMap(input: {
  visma_sales_code: string;
  crm_sales_id: number | null;
  /** Brief 73 §1b (21. sep 2026): sælgerkode-mapping skal bære et menneske.
   *  Callers henter identity via useGetIdentity(). */
  updated_by: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("sales_code_map_lago")
    .update({
      crm_sales_id: input.crm_sales_id,
      updated_at: new Date().toISOString(),
      updated_by: input.updated_by,
    })
    .eq("visma_sales_code", input.visma_sales_code);
  if (error) throw error;
}

/**
 * Kalder DB-funktionen derive_sales_id_from_visma() — single source of
 * truth for hvordan companies.sales_id afledes af VISMA-koden. RLS
 * gates til admin. Returnerer completeness-tal så UI'et kan vise en
 * fuldstændigheds-check uden at slå op i basen: summen af updated +
 * ok_no_change + system_code_null + skipped_null_code skal altid være
 * total. Går den ikke op, er noget uforudset sket.
 */
export interface DeriveSalesIdResult {
  total: number;
  updated: number;
  set_to_null: number;
  ok_no_change: number;
  system_code_null: number;
  skipped_null_code: number;
  invariant_holds: boolean;
  ran_at: string;
}

export async function runDeriveSalesIdFromVisma(): Promise<DeriveSalesIdResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("derive_sales_id_from_visma");
  if (error) throw error;
  return data as DeriveSalesIdResult;
}

// ---------------------------------------------------------------------
// Brief 42-korrektur (16. sep 2026) · Send adgangskode-link
// ---------------------------------------------------------------------
// LAGO's brugeroprettelse kalder `admin.createUser` med `email_confirm:
// true`, dvs. brugeren er allerede confirmed i auth.users når rækken
// oprettes. Det tidligere "Send invitation"-flow forsøgte at kalde
// `inviteUserByEmail`, som fejler mod eksisterende brugere. Der er
// derfor kun ét reelt flow: send et adgangskode-recovery-link.
//
// `resetPasswordForEmail` sender samme mail uanset om brugeren aldrig
// har logget ind eller har glemt sit kodeord — én sti dækker begge.
// Kald sker client-side (ingen Edge Function) fordi auth-endpointet er
// public og kun kræver anon key.
//
// Sikkerheds-note: Supabase's `resetPasswordForEmail` returnerer OK
// selv for ukendte adresser (for at forhindre email-enumeration). For
// at undgå at admin tror mailen er afsendt til en tom sales-række,
// disabler UI-knappen (SendPasswordLinkButton) hvis `sales.user_id`
// er null — så kaldet sker kun for rækker der HAR en auth-bruger.

export async function sendPasswordLink(email: string): Promise<{
  ok: true;
  email: string;
}> {
  if (!email || !email.includes("@")) {
    throw new Error("Ingen gyldig e-mail på brugeren");
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth-callback.html`,
  });
  if (error) {
    throw new Error(
      (await readEdgeFunctionError(error)) ||
        "Kunne ikke sende adgangskode-link",
    );
  }
  return { ok: true, email };
}
