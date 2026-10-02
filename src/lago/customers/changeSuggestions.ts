import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 46 · Ændringsforslag til VISMA-ejede felter.
 *
 * Loopet: sælger foreslår → kontoret retter i VISMA → importen henter
 * det hjem → close_matched_change_suggestions() lukker forslaget.
 * Alt indenfor tabellen kunde_aendringsforslag_lago.
 */

export type SuggestionStatus =
  | "afventer"
  | "gennemfoert"
  | "afvist"
  | "bortfaldet";
export type FeltSource = "companies" | "companies_lago";

export interface ChangeSuggestion {
  id: number;
  companyId: number;
  companyName?: string;
  felt: string;
  feltSource: FeltSource;
  nuvaerendeVaerdi: string | null;
  foreslaaetVaerdi: string;
  note: string | null;
  foreslaaetAf: number | null;
  foreslaaetAfNavn: string | null;
  oprettet: string;
  status: SuggestionStatus;
  lukket: string | null;
  lukketAf: number | null;
  lukketGrund: string | null;
}

export interface CreateSuggestionInput {
  companyId: number;
  felt: string;
  feltSource: FeltSource;
  nuvaerendeVaerdi: string | null;
  foreslaaetVaerdi: string;
  note: string | null;
  foreslaaetAf: number | null;
}

interface SupabaseSuggestionRow {
  id: number;
  company_id: number;
  felt: string;
  felt_source: FeltSource;
  nuvaerende_vaerdi: string | null;
  foreslaaet_vaerdi: string;
  note: string | null;
  foreslaaet_af: number | null;
  oprettet: string;
  status: SuggestionStatus;
  lukket: string | null;
  lukket_af: number | null;
  lukket_grund: string | null;
  companies?: { name: string | null } | Array<{ name: string | null }> | null;
  sales?:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
}

function mapRow(r: SupabaseSuggestionRow): ChangeSuggestion {
  const co = Array.isArray(r.companies) ? r.companies[0] : r.companies;
  const s = Array.isArray(r.sales) ? r.sales[0] : r.sales;
  const foreslaaetAfNavn = s
    ? [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || null
    : null;
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: co?.name ?? undefined,
    felt: r.felt,
    feltSource: r.felt_source,
    nuvaerendeVaerdi: r.nuvaerende_vaerdi,
    foreslaaetVaerdi: r.foreslaaet_vaerdi,
    note: r.note,
    foreslaaetAf: r.foreslaaet_af,
    foreslaaetAfNavn,
    oprettet: r.oprettet,
    status: r.status,
    lukket: r.lukket,
    lukketAf: r.lukket_af,
    lukketGrund: r.lukket_grund,
  };
}

export async function createChangeSuggestion(
  input: CreateSuggestionInput,
): Promise<ChangeSuggestion> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("kunde_aendringsforslag_lago")
    .insert({
      company_id: input.companyId,
      felt: input.felt,
      felt_source: input.feltSource,
      nuvaerende_vaerdi: input.nuvaerendeVaerdi,
      foreslaaet_vaerdi: input.foreslaaetVaerdi,
      note: input.note,
      foreslaaet_af: input.foreslaaetAf,
    })
    .select(
      "id, company_id, felt, felt_source, nuvaerende_vaerdi, foreslaaet_vaerdi, note, foreslaaet_af, oprettet, status, lukket, lukket_af, lukket_grund",
    )
    .single<SupabaseSuggestionRow>();
  if (error) throw error;
  return mapRow(data);
}

/** Alle afventende forslag på en kunde — bruges af kundekortet til at
 *  vise "Forslag afventer: X — Y, dato"-linjer under VISMA-felter. */
export async function fetchOpenSuggestionsForCompany(
  companyId: number,
): Promise<ChangeSuggestion[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("kunde_aendringsforslag_lago")
    .select(
      "id, company_id, felt, felt_source, nuvaerende_vaerdi, foreslaaet_vaerdi, note, foreslaaet_af, oprettet, status, lukket, lukket_af, lukket_grund, sales:foreslaaet_af(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .eq("status", "afventer")
    .order("oprettet", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SupabaseSuggestionRow[]).map(mapRow);
}

/** Kontorets kø: alle afventende + evt. dæmpede efter 30 dage. Bruges
 *  af ForslagRettelserWidget. */
export async function fetchOpenSuggestions(): Promise<ChangeSuggestion[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("kunde_aendringsforslag_lago")
    .select(
      "id, company_id, felt, felt_source, nuvaerende_vaerdi, foreslaaet_vaerdi, note, foreslaaet_af, oprettet, status, lukket, lukket_af, lukket_grund, companies:companies!inner(name), sales:foreslaaet_af(first_name, last_name)",
    )
    .eq("status", "afventer")
    .order("oprettet", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as SupabaseSuggestionRow[]).map(mapRow);
}

export async function markSuggestionDone(input: {
  id: number;
  lukketAf: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("kunde_aendringsforslag_lago")
    .update({
      status: "gennemfoert",
      lukket: new Date().toISOString(),
      lukket_af: input.lukketAf,
      lukket_grund: "manuelt markeret rettet",
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function rejectSuggestion(input: {
  id: number;
  grund: string;
  lukketAf: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("kunde_aendringsforslag_lago")
    .update({
      status: "afvist",
      lukket: new Date().toISOString(),
      lukket_af: input.lukketAf,
      lukket_grund: input.grund,
    })
    .eq("id", input.id);
  if (error) throw error;
}
