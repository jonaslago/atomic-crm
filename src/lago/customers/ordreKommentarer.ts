import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 89 · Ordrekommentarer, handlinger og aftalte leveringsdatoer.
 *
 * Sælgeren står hos kunden, kunden siger "send Barolo'en nu, hold resten
 * til december". Kommentaren er den strukturerede overlevering. Kontoret
 * handler i VISMA — vi skriver aldrig direkte til VISMA. Auto-luk fyrer
 * når importen viser at handling er sket (funktionen findes, koblingen
 * til importen er en åben post — dokumenteret i migration 89).
 *
 * Under dækning: oprettet_af = actorSalesId (den handlende, ikke den
 * passede). Brief 84 §1's mønster gentaget.
 */

export type OrdreKommentarHensigt =
  | "send_nu"
  | "afvent"
  | "leveringsdato"
  | "ring_kunde"
  | "andet"
  // Brief 89 tillæg A (28. sep 2026): sjette hensigt. Hører sammen med
  // "Venter på andre varer" i Salg og ordrer — sælgeren kan nu selv
  // sætte en ordre i MAV-tilstand i stedet for kun at opdage den bagefter.
  // Virker begge veje: en MAV-linje kan få hensigten "Send nu".
  // Seks er grænsen (brief 89 §2).
  | "send_med_naeste_ordre";

export type OrdreKommentarStatus =
  | "afventer"
  | "udfoert"
  | "afvist"
  | "bortfaldet";

export const HENSIGT_LABEL: Record<OrdreKommentarHensigt, string> = {
  send_nu: "Send nu",
  send_med_naeste_ordre: "Send med næste ordre",
  leveringsdato: "Leveringsdato aftalt",
  ring_kunde: "Ring til kunden først",
  afvent: "Afvent",
  andet: "Andet",
};

export const HENSIGT_HINT: Record<OrdreKommentarHensigt, string> = {
  send_nu: "Kontoret ekspederer så snart de kan.",
  send_med_naeste_ordre: "Varerne venter, til der er noget at sende dem med.",
  leveringsdato:
    "Datoen sættes i VISMA (Ønsket lev. Dato) og ordren leveres på den.",
  ring_kunde: "Afklaring mangler — kontoret ringer kunden op først.",
  afvent: "Kontoret rører den ikke — noten siger hvorfor.",
  andet: "Læs noten.",
};

export interface OrdreKommentar {
  id: number;
  companyId: number;
  companyName?: string;
  ordreNr: string;
  hensigt: OrdreKommentarHensigt;
  aftaltDato: string | null;
  note: string | null;
  oprettetAf: number | null;
  oprettetAfNavn: string | null;
  oprettet: string;
  status: OrdreKommentarStatus;
  lukket: string | null;
  lukketAf: number | null;
  lukketGrund: string | null;
}

export interface CreateOrdreKommentarInput {
  companyId: number;
  ordreNumre: string[];
  hensigt: OrdreKommentarHensigt;
  aftaltDato: string | null;
  note: string | null;
  oprettetAf: number | null;
}

interface SupabaseKommentarRow {
  id: number;
  company_id: number;
  ordre_nr: string;
  hensigt: OrdreKommentarHensigt;
  aftalt_dato: string | null;
  note: string | null;
  oprettet_af: number | null;
  oprettet: string;
  status: OrdreKommentarStatus;
  lukket: string | null;
  lukket_af: number | null;
  lukket_grund: string | null;
  companies?:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  sales?:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
}

function mapRow(r: SupabaseKommentarRow): OrdreKommentar {
  const co = Array.isArray(r.companies) ? r.companies[0] : r.companies;
  const s = Array.isArray(r.sales) ? r.sales[0] : r.sales;
  const oprettetAfNavn = s
    ? [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || null
    : null;
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: co?.name ?? undefined,
    ordreNr: r.ordre_nr,
    hensigt: r.hensigt,
    aftaltDato: r.aftalt_dato,
    note: r.note,
    oprettetAf: r.oprettet_af,
    oprettetAfNavn,
    oprettet: r.oprettet,
    status: r.status,
    lukket: r.lukket,
    lukketAf: r.lukket_af,
    lukketGrund: r.lukket_grund,
  };
}

/**
 * Kommentarer på en specifik kundes åbne ordrer. Bruges af kundekortets
 * ordreliste. Filter på status=afventer så listen ikke drukner i
 * lukkede rækker over tid.
 */
export async function fetchOrdreKommentarerForCompany(
  companyId: number,
): Promise<OrdreKommentar[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ordre_kommentar_lago")
    .select(
      "id, company_id, ordre_nr, hensigt, aftalt_dato, note, oprettet_af, oprettet, status, lukket, lukket_af, lukket_grund, sales:sales!oprettet_af(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .eq("status", "afventer")
    .order("oprettet", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as SupabaseKommentarRow[]).map(mapRow);
}

/**
 * Alle afventende kommentarer (kontor-widget). Sorteret så "Send nu"
 * står øverst — det er dem der haster.
 */
export async function fetchAfventendeOrdreKommentarer(): Promise<OrdreKommentar[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ordre_kommentar_lago")
    .select(
      "id, company_id, ordre_nr, hensigt, aftalt_dato, note, oprettet_af, oprettet, status, lukket, lukket_af, lukket_grund, companies:companies!inner(name), sales:sales!oprettet_af(first_name, last_name)",
    )
    .eq("status", "afventer")
    .order("oprettet", { ascending: false });
  if (error) throw error;
  const rows = ((data ?? []) as unknown as SupabaseKommentarRow[]).map(mapRow);
  // Client-side re-sort: "send_nu" først, resten i tid-rækkefølge.
  const priority: Record<OrdreKommentarHensigt, number> = {
    send_nu: 0,
    ring_kunde: 1,
    leveringsdato: 2,
    send_med_naeste_ordre: 3,
    afvent: 4,
    andet: 5,
  };
  return rows.sort((a, b) => {
    const p = priority[a.hensigt] - priority[b.hensigt];
    if (p !== 0) return p;
    return a.oprettet < b.oprettet ? 1 : -1;
  });
}

/**
 * Opret én række pr. ordre. Flervalg → N rows. Så kan de lukkes hver
 * for sig efterhånden som ordrerne ekspederes.
 */
export async function createOrdreKommentarer(
  input: CreateOrdreKommentarInput,
): Promise<OrdreKommentar[]> {
  const supabase = getSupabaseClient();
  const rows = input.ordreNumre.map((ordre_nr) => ({
    company_id: input.companyId,
    ordre_nr,
    hensigt: input.hensigt,
    aftalt_dato: input.aftaltDato,
    note: input.note,
    oprettet_af: input.oprettetAf,
  }));
  const { data, error } = await supabase
    .from("ordre_kommentar_lago")
    .insert(rows)
    .select(
      "id, company_id, ordre_nr, hensigt, aftalt_dato, note, oprettet_af, oprettet, status, lukket, lukket_af, lukket_grund",
    );
  if (error) throw error;
  return ((data ?? []) as unknown as SupabaseKommentarRow[]).map(mapRow);
}

export interface CloseKommentarInput {
  id: number;
  status: "udfoert" | "afvist";
  lukketAf: number | null;
  lukketGrund: string | null;
}

export async function closeOrdreKommentar(
  input: CloseKommentarInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("ordre_kommentar_lago")
    .update({
      status: input.status,
      lukket: new Date().toISOString(),
      lukket_af: input.lukketAf,
      lukket_grund: input.lukketGrund,
    })
    .eq("id", input.id);
  if (error) throw error;
}
