// Shared types for the sales-import UI (Domain-brief 19b, rev 4. sep 2026).
//
// Alle 5 filtyper afleverer det samme grundlæggende DryRun-shape så
// summary-komponenten kan tegne dem ens. Payload-shapen adskiller sig
// per type — den er kun brugt af executeImport, ikke af UI'et.

export type ImportKind =
  | "produkttransaktioner"
  | "kunder"
  | "aabne_ordrer"
  | "produkter"
  | "kontakter";

export interface HeaderMappingError {
  kind: "header-missing";
  missingColumns: string[];
  foundHeaders: string[];
}

export interface RowError {
  rowIndex: number; // 1-baseret (matcher Excel-visningen)
  message: string;
}

export interface DryRunResult<TPayload> {
  ok: boolean;
  headerError?: HeaderMappingError;
  rowsInFile: number;
  rowsAfterFilter: number;
  totalBelob?: number;
  periodTotals?: { label: string; belob: number }[];
  matchedCustomers?: number;
  unknownCustomers?: string[];
  categoryBreakdown?: { label: string; rows: number; belob: number }[];
  rowErrors: RowError[];
  payload?: TPayload;
}

// -------------- Produkttransaktioner --------------

export interface SalesMonthlyRow {
  visma_customer_no: string;
  aar: number;
  maaned: number;
  produktnr: string; // "" hvis mangler
  salgstype: string; // "" hvis mangler
  belob: number;
  antal: number;
  // Tillæg B: vareforbrug, aggregeret på samme kornstørrelse som
  // belob og antal. Ingen visning bygget nu — dækningsgrad-arsenalet.
  forbrugt: number;
}

export type ProdukttransaktionerPayload = SalesMonthlyRow[];

// -------------- Kunder --------------

export interface KunderRow {
  visma_customer_no: string;
  distrikt: string | null;
  kundetype: "engros" | "horeca" | "andre" | null;
  is_active: boolean | null;
  // Brief 25 §1 + Brief 24: VISMA-sælgerkode. Skrives til
  // companies_lago.visma_sales_code så derive_sales_id_from_visma()
  // kan afledet companies.sales_id.
  visma_sales_code: string | null;
  // Brief 26 §1: navn behøves ved INSERT af nye kunder. companies.name
  // er NOT NULL — vi må have noget. Kan være null for eksisterende
  // (parseren læser den, importen ignorerer null ved UPDATE — så
  // eksisterende værdi bevares hvis feltet er tomt i VISMA-filen).
  navn: string | null;
  // Tillæg 26A: kerne-stamdata skrives til public.companies.
  // "Overskriv ikke med tomt" — importen skipper null ved UPDATE.
  adresse1: string | null;
  postnr: string | null;
  by: string | null;
  land: string | null;
  telefon: string | null;
  email: string | null;
  cvr: string | null;
  webside: string | null;
  // Tillæg 26A: LAGO-sidecar (companies_lago). Gem-men-vis-ikke.
  adresse2: string | null;
  branche: string | null;
  aktoernr: string | null;
  er_web_kunde: boolean | null;
  kreditspaerre: boolean | null;
  omraade: string | null;
  ansvarlig: string | null;
  // Brief 39 (16. sep 2026): fri tekst fra Kundeudtrækkets Debitorinfo-
  // kolonne. Tidligere hed feltet Oplysning 7 (udgået).
  debitorinfo: string | null;
}

export type KunderPayload = KunderRow[];

// -------------- Åbne ordrer (kombineret Ordrer + Ordrelinjer) --------

export interface OpenOrderRow {
  ordre_nr: string;
  linje_nr: string;
  visma_customer_no: string;
  ordre_dato: string;
  // Brief 25: ordreart deprecated — bevares som fossil for gammel data.
  // Ny import skriver null her.
  ordreart: string | null;
  // Brief 25 §1: VISMAs Levering-kolonne, primær kategori-input.
  levering: string | null;
  // OSRs "Ordrestatus" — vores schema kolonne hedder stadig "status".
  status: string | null;
  kampagne: string | null;
  saelger: string | null;
  produktnr: string | null;
  produktgruppe: string | null;
  kundeprisgruppe: string | null;
  salgstype: string | null;
  antal: number | null;
  // Brief 25 §2 · rev. brief 78 tillæg A §1 (22. sep 2026): rest = antal
  // − reserveret_mod_lager (VISMAs egen formel, "I rest"). Brief 25's
  // rest = antal − antal_faerdigmeldt gav altid rest = antal fordi LAGO
  // aldrig dellevererer på samme ordre.
  antal_faerdigmeldt: number | null;
  rest: number | null;
  // Brief 25: i_rest deprecated (VISMA eksponerer den ikke i OSR).
  i_rest: number | null;
  ej_faktureret: number;
  oensket_leveringsdato: string | null;
  faerdigmeldingsdato: string | null;
  sellerno: string | null;
  // Tillæg B — fire nye felter så lager/dato/MAV kan besvares hver
  // for sig, uden at være låst inde i én kategori-kaskade.
  reserveret_mod_lager: number | null;
  lagerstatus: "klar" | "delvis" | "restordre";
  mav: boolean;
  har_oensket_dato: boolean;
  forbrugt: number | null;
  // Brief 78 tillæg A §3 (22. sep 2026): OSRs Note-kolonne — ordrens
  // formål (ens på alle linjer i ordren).
  note: string | null;
  // Brief 78 §1 (22. sep 2026): rå værdi fra "Undtages lagerhåndtering".
  // Filteret er fjernet — feltet bevares så par-håndtering kan ske i
  // visnings-laget.
  undtages_lagerhaandtering: boolean;
}

export type AabneOrdrerPayload = OpenOrderRow[];

// -------------- Produkter (stamdata) --------------

export interface ProduktRow {
  produktnr: string;
  beskrivelse: string | null;
  // Brief 25 §4.1: bogfoeringsgruppe dropped; produktgruppe erstatter.
  produktgruppe: string | null;
  oprindelsesland: string | null;
  appellation: string | null;
  farve_type: string | null;
  aargang: string | null;
  producent: string | null;
  alc_pct: number | null;
  oekologi: string | null;
  status: string | null;
  lagerenhed: string | null;
  ant_pr_kolli: number | null;
  // Brief 25 §4.2: lagerdata gemmes; skærm bygges senere.
  fysisk_beholdning: number | null;
  reserveret: number | null;
  tilgang: number | null;
  realiseret_beholdning: number | null;
}

export type ProdukterPayload = ProduktRow[];

// -------------- Kontakter (Domain-brief 29) ------------------------
//
// Engangsimport af VISMAs kontaktpersoner. Header i række 2, kobling
// på kundens Aktørnr. via "Kontaktperson for", dedupering på
// kontaktens egen Aktørnr. + navn. CRM'et er master fra 16. sep 2026 —
// filen må ikke i det natlige flow.

export interface KontaktRow {
  /** Kontaktens egen Aktørnr. i VISMA. Bruges som dedupering-nøgle. */
  kontakt_aktoer_nr: string | null;
  /** Kundens Aktørnr. — kolonnen "Kontaktperson for". Match mod
   *  companies_lago.visma_aktoer_nr for at finde kunden. */
  kunde_aktoer_nr: string;
  fornavn: string;
  efternavn: string | null;
  titel: string | null;
  email: string | null;
  mobiltelefon: string | null;
  telefon: string | null;
  /** Webkunde 1/0 → true/false. 182 af 528 er webshop-brugere. */
  is_webshop: boolean;
  visma_created_by: string | null;
  visma_created_at: string | null; // ISO date
  visma_updated_by: string | null;
  visma_updated_at: string | null;
}

export type KontakterPayload = KontaktRow[];
