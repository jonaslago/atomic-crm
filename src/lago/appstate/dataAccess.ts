import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 57 · driftstilstand. app_state_lago har altid præcis én række
 * (id=1); den kan læses af alle authenticated brugere, kun opdateres af
 * admin (håndhævet via RLS).
 *
 * Rå-shape spejler tabellen. UI-laget beslutter selv om `vedligehold` +
 * `slutter > now()` skal tolkes som "aktivt vindue".
 */

export interface AppState {
  id: number;
  vedligehold: boolean;
  besked: string | null;
  slutter: string | null; // ISO
  slaaet_til_af: number | null;
  slaaet_til: string | null; // ISO
}

const DEFAULT_STATE: AppState = {
  id: 1,
  vedligehold: false,
  besked: null,
  slutter: null,
  slaaet_til_af: null,
  slaaet_til: null,
};

/**
 * Brief 57 §5: fail-open. En kortvarig netværksfejl må ikke låse hele
 * salgsstyrken ude — kan flaget ikke læses, giver vi et "åbent" state
 * tilbage. Tabellen er én række som ingen migration rører; fejler
 * dette opslag, er noget større galt og appen er brudt alligevel.
 */
export async function fetchAppState(): Promise<AppState> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_state_lago")
    .select("id, vedligehold, besked, slutter, slaaet_til_af, slaaet_til")
    .eq("id", 1)
    .maybeSingle<AppState>();
  if (error || !data) return DEFAULT_STATE;
  return data;
}

/**
 * Slå vedligeholdelse til med varighed i minutter. Sætter slutter =
 * now() + minutes. Kan kaldes igen mens vedligeholdelse er slået til
 * for at forlænge (slutter overskrives).
 */
export async function slaaMaintenanceTil(input: {
  minutes: number;
  besked: string | null;
  slaaetTilAfSalesId: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const slutter = new Date(now.getTime() + input.minutes * 60_000);
  const { error } = await supabase
    .from("app_state_lago")
    .update({
      vedligehold: true,
      besked: input.besked?.trim() || null,
      slutter: slutter.toISOString(),
      slaaet_til_af: input.slaaetTilAfSalesId,
      slaaet_til: now.toISOString(),
    })
    .eq("id", 1);
  if (error) throw error;
}

/**
 * "Luk op igen" — Brief 57 §2. Slår vedligeholdelse fra før tid.
 * Nulstiller også slutter/besked så tilstanden ikke bærer stale info
 * ind i næste vindue.
 */
export async function lukOpIgen(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("app_state_lago")
    .update({
      vedligehold: false,
      besked: null,
      slutter: null,
    })
    .eq("id", 1);
  if (error) throw error;
}

/**
 * Er vindue aktivt lige nu? Brief 57 §2: slutter afgør. Er slutter i
 * fortiden, er vindue lukket automatisk uanset vedligehold-flaget.
 * Så en admin der glemte at slå fra får ikke låst systemet ude ud
 * over det aftalte tidspunkt.
 */
export function isMaintenanceActive(state: AppState, now: Date = new Date()): boolean {
  if (!state.vedligehold) return false;
  if (!state.slutter) return false;
  return new Date(state.slutter).getTime() > now.getTime();
}
