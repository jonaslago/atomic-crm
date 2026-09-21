// Import-execution + sync_runs-logging.
//
// Alle skriv-operationer er admin-gated via RLS på tabellerne. Vi bruger
// den authenticated Supabase-klient direkte fra frontend.

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  AabneOrdrerPayload,
  KontakterPayload,
  KunderPayload,
  ProdukterPayload,
  ProdukttransaktionerPayload,
} from "./types";

const BATCH_SIZE = 500;
// Bulk-select-URL'en med .in() har grænser i både PostgREST og
// Supabase-pooleren. 5.070 varenumre var nok til at overskride det og
// give "TypeError: Load failed" (fetch aborted). Konservativt:
// 200 IDs pr. chunk. Både .in()-lookups og .upsert() skal chunkes.
const LOOKUP_CHUNK_SIZE = 200;

async function inBatches<T>(
  rows: T[],
  fn: (batch: T[], batchIdx: number, totalBatches: number) => Promise<void>,
): Promise<void> {
  const total = Math.ceil(rows.length / BATCH_SIZE);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await fn(rows.slice(i, i + BATCH_SIZE), Math.floor(i / BATCH_SIZE), total);
  }
}

/**
 * Chunked .in()-lookup — undgår at bygge URL'er der er så lange at
 * fetch aborter med "TypeError: Load failed". Returnerer en flad map
 * fra key til projekterede felter.
 */
async function chunkedLookup<T extends Record<string, unknown>>(opts: {
  table: string;
  keyColumn: string;
  keys: string[];
  select: string;
}): Promise<T[]> {
  const supabase = getSupabaseClient();
  const results: T[] = [];
  for (let i = 0; i < opts.keys.length; i += LOOKUP_CHUNK_SIZE) {
    const chunk = opts.keys.slice(i, i + LOOKUP_CHUNK_SIZE);
    const { data, error } = await supabase
      .from(opts.table)
      .select(opts.select)
      .in(opts.keyColumn, chunk);
    if (error) {
      throw new Error(
        `Opslag mod ${opts.table} fejlede (chunk ${i / LOOKUP_CHUNK_SIZE + 1}): ${error.message}`,
      );
    }
    results.push(...((data ?? []) as T[]));
  }
  return results;
}

async function logSyncRun(input: {
  datasaet: "sales_monthly" | "open_orders" | "customers" | "products";
  raekker: number;
  er_testdata: boolean;
  periode_fra?: string | null;
  periode_til?: string | null;
  note?: string;
  /** Brief 73 §1c (21. sep 2026): hvem trykkede Kør. Importen er kørt 29
   *  gange af et menneske uden at være registreret — det er svaret på
   *  "hvem kørte den import, der ændrede tallene i morges?". Callers
   *  henter identity via useGetIdentity() og sender ned. */
  koert_af: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("sync_runs_lago").insert({
    datasaet: input.datasaet,
    kilde: "import",
    raekker: input.raekker,
    periode_fra: input.periode_fra ?? null,
    periode_til: input.periode_til ?? null,
    er_testdata: input.er_testdata,
    note: input.note ?? null,
    koert_af: input.koert_af,
  });
  if (error) throw error;
}

// -------------------- Produkttransaktioner --------------------

export async function importProdukttransaktioner(
  payload: ProdukttransaktionerPayload,
  er_testdata: boolean,
  koert_af: number | null,
): Promise<{ rowsWritten: number }> {
  const supabase = getSupabaseClient();

  // Idempotent upsert på (kundenr, år, måned, salgstype). Vi
  // OVERSKRIVER belob — hvis samme nøgle sendes to gange, vinder
  // sidste værdi (matches importen af "kør igen med rettet fil").
  await inBatches(payload, async (batch) => {
    const rows = batch.map((r) => ({
      visma_customer_no: r.visma_customer_no,
      aar: r.aar,
      maaned: r.maaned,
      produktnr: r.produktnr,
      salgstype: r.salgstype,
      belob: r.belob,
      antal: r.antal,
      er_testdata,
      kilde: "import" as const,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("sales_monthly_lago").upsert(rows, {
      onConflict: "visma_customer_no,aar,maaned,produktnr,salgstype",
    });
    if (error) throw error;
  });

  // Periode-range for sync_runs
  const monthsIso = payload
    .map((r) => `${r.aar}-${String(r.maaned).padStart(2, "0")}-01`)
    .sort();

  await logSyncRun({
    datasaet: "sales_monthly",
    raekker: payload.length,
    er_testdata,
    periode_fra: monthsIso[0] ?? null,
    periode_til: monthsIso[monthsIso.length - 1] ?? null,
    note: er_testdata ? "testdata" : "driftsdata",
    koert_af,
  });

  return { rowsWritten: payload.length };
}

// -------------------- Kunder --------------------

export async function importKunder(
  payload: KunderPayload,
  er_testdata: boolean,
  koert_af: number | null,
): Promise<{ rowsWritten: number }> {
  const supabase = getSupabaseClient();

  // Kunder opdateres én ad gangen på visma_customer_no (COALESCE-mønster
  // via UPDATE — vi rører kun de felter denne fil ejer, andre CRM-felter
  // bevares). "Rør ikke kunder der ikke er i CRM'et" håndteres af
  // parseren (payload indeholder kun matches).
  //
  // NB: er_testdata gælder salgsdata; kundeopdatering er master-data.
  // Loggen får dog flag med så vi kan spore hvornår rutinen kørte.
  // Brief 26 §1: importen kan nu OPRETTE nye kunder. Vi må først vide
  // hvilke visma_customer_no der allerede findes. Chunkes for at undgå
  // "TypeError: Load failed" ved for lange URL'er (samme fælde som
  // ramte produkter-importen — kunder-filen kan sagtens overskride
  // URL-grænsen ved fx 5.000+ eksisterende).
  const kundenumre = payload.map((r) => r.visma_customer_no);
  let existing: { visma_customer_no: string; company_id: number }[];
  try {
    existing = await chunkedLookup<{
      visma_customer_no: string;
      company_id: number;
    }>({
      table: "companies_lago",
      keyColumn: "visma_customer_no",
      keys: kundenumre,
      select: "visma_customer_no, company_id",
    });
  } catch (err) {
    const currentCount = await countInTable("companies_lago");
    throw new Error(
      `Kunne ikke slå eksisterende kunder op inden import (0 rækker skrevet). ` +
        `${currentCount} kunder står i companies_lago før forsøget. ` +
        `Prøv igen — filen kan uploades uændret. Detaljer: ${(err as Error).message}`,
    );
  }
  const existingMap = new Map<string, number>();
  for (const row of existing) {
    if (row.visma_customer_no && typeof row.company_id === "number") {
      existingMap.set(row.visma_customer_no, row.company_id);
    }
  }

  let n_created = 0;
  let n_updated = 0;

  // Tillæg 26A: helper der bygger et patch-objekt uden tomme felter.
  // "Overskriv ikke med tomt" — et tomt felt i VISMA må ikke slette en
  // værdi CRM'et har. Same regel som brief 26 fulgte for is_active.
  const setIfNotNull = (
    patch: Record<string, unknown>,
    key: string,
    value: unknown,
  ) => {
    if (value !== null && value !== undefined && value !== "") {
      patch[key] = value;
    }
  };

  await inBatches(payload, async (batch) => {
    for (const r of batch) {
      const isExisting = existingMap.has(r.visma_customer_no);
      const now = new Date().toISOString();

      // companies-patch (VISMA-master, kerne-stamdata).
      const companiesPatch: Record<string, unknown> = {};
      setIfNotNull(companiesPatch, "name", r.navn);
      setIfNotNull(companiesPatch, "address", r.adresse1);
      setIfNotNull(companiesPatch, "zipcode", r.postnr);
      setIfNotNull(companiesPatch, "city", r.by);
      setIfNotNull(companiesPatch, "country", r.land);
      setIfNotNull(companiesPatch, "phone_number", r.telefon);
      setIfNotNull(companiesPatch, "tax_identifier", r.cvr);
      setIfNotNull(companiesPatch, "website", r.webside);

      // companies_lago-patch (LAGO sidecar).
      const lagoPatch: Record<string, unknown> = { updated_at: now };
      setIfNotNull(lagoPatch, "distrikt", r.distrikt);
      setIfNotNull(lagoPatch, "kundetype", r.kundetype);
      if (r.is_active != null) lagoPatch.is_active = r.is_active;
      setIfNotNull(lagoPatch, "visma_sales_code", r.visma_sales_code);
      setIfNotNull(lagoPatch, "adresse2", r.adresse2);
      // Brief 53 §3 + Brief 55 tillæg A (17. sep 2026): kolonnen er
      // omdøbt fra `branche` til `branche_visma_tekst` — fritekst-værdien
      // fra VISMA bevares uændret. `branche_kode` (FK) opdateres i
      // et post-processing-step nedenfor.
      setIfNotNull(lagoPatch, "branche_visma_tekst", r.branche);
      setIfNotNull(lagoPatch, "visma_aktoer_nr", r.aktoernr);
      setIfNotNull(lagoPatch, "omraade", r.omraade);
      setIfNotNull(lagoPatch, "ansvarlig", r.ansvarlig);
      if (r.er_web_kunde != null) lagoPatch.er_web_kunde = r.er_web_kunde;
      // Brief 68 (21. sep 2026): VISMA eksporterer "Nej" for ikke-spærret
      // (tom ses ikke i praksis — efterprøvet: 1149 × false, 16 × true,
      // 3 × null i drift). parseBoolFlag mapper "Nej"→false, saa vagten
      // != null slipper false igennem og spærringen kan haeves. Samme for
      // er_web_kunde ovenover.
      if (r.kreditspaerre != null) lagoPatch.kreditspaerre = r.kreditspaerre;
      // Emailen ligger på companies_lago.faktura_email (der er ingen
      // email-kolonne på companies).
      setIfNotNull(lagoPatch, "faktura_email", r.email);
      // Brief 39 (16. sep 2026): Debitorinfo fra Kundeudtrækket.
      setIfNotNull(lagoPatch, "debitorinfo", r.debitorinfo);

      if (isExisting) {
        // UPDATE eksisterende. Skip stille hvis intet at ændre.
        const companyId = existingMap.get(r.visma_customer_no)!;
        if (Object.keys(companiesPatch).length > 0) {
          const { error } = await supabase
            .from("companies")
            .update(companiesPatch)
            .eq("id", companyId);
          if (error) throw error;
        }
        if (Object.keys(lagoPatch).length > 1) {
          // > 1 fordi updated_at altid er der; ingen andre = ingen ændring.
          const { error } = await supabase
            .from("companies_lago")
            .update(lagoPatch)
            .eq("visma_customer_no", r.visma_customer_no);
          if (error) throw error;
        }
        n_updated++;
      } else {
        // INSERT ny kunde (Brief 26 §1). companies.name er NOT NULL —
        // vi bruger navn fra OSR eller falder tilbage til
        // "VISMA-<kundenr>" så INSERT ikke fejler pr. row. Segment
        // sættes til "X" (uafklaret, ingen besøgsinterval — SEG-4).
        // Ejerskab afledes af derive_sales_id_from_visma() til sidst.
        const insertRow = {
          name: r.navn || `VISMA-${r.visma_customer_no}`,
          address: r.adresse1 ?? null,
          zipcode: r.postnr ?? null,
          city: r.by ?? null,
          country: r.land ?? null,
          phone_number: r.telefon ?? null,
          tax_identifier: r.cvr ?? null,
          website: r.webside ?? null,
        };
        const { data: created, error: coErr } = await supabase
          .from("companies")
          .insert(insertRow)
          .select("id")
          .single();
        if (coErr || !created) {
          throw new Error(
            `Kunne ikke oprette companies-række for ${r.visma_customer_no}: ${coErr?.message ?? "no id returned"}`,
          );
        }
        const lagoInsert: Record<string, unknown> = {
          company_id: created.id,
          visma_customer_no: r.visma_customer_no,
          distrikt: r.distrikt,
          kundetype: r.kundetype,
          is_active: r.is_active,
          visma_sales_code: r.visma_sales_code,
          segment: "X",
          updated_at: now,
          adresse2: r.adresse2,
          branche_visma_tekst: r.branche,
          visma_aktoer_nr: r.aktoernr,
          omraade: r.omraade,
          ansvarlig: r.ansvarlig,
          er_web_kunde: r.er_web_kunde,
          kreditspaerre: r.kreditspaerre,
          faktura_email: r.email,
          debitorinfo: r.debitorinfo,
        };
        const { error: clErr } = await supabase
          .from("companies_lago")
          .insert(lagoInsert);
        if (clErr) {
          // Rollback companies-insert (ellers ligger navnet uden lago-row).
          await supabase.from("companies").delete().eq("id", created.id);
          throw new Error(
            `Kunne ikke oprette companies_lago-række for ${r.visma_customer_no}: ${clErr.message}`,
          );
        }
        n_created++;
      }
    }
  });

  // Brief 25 §1 + Brief 24: sidste skridt af kundeimporten er at aflede
  // ejerskab. Én kilde til sandhed. derive_sales_id_from_visma()
  // returnerer completeness-tal — log dem så vi kan se om invarianten
  // holdt uden at slå op i basen.
  const { data: deriveResult, error: deriveError } = await supabase.rpc(
    "derive_sales_id_from_visma",
  );
  if (deriveError) {
    // Non-fatal: kundedata er skrevet. Log fejl, fortsæt.
    console.error("derive_sales_id_from_visma failed:", deriveError);
  }

  // Brief 46 (16. sep 2026): loop-lukningen for ændringsforslag. Nu
  // hvor VISMA-værdierne er opdateret i basen, lukker vi alle
  // afventende forslag der matcher den nye tilstand. Non-fatal —
  // forslag der ikke lukkes står blot afventende til næste kørsel.
  const { data: closedCount, error: closeError } = await supabase.rpc(
    "close_matched_change_suggestions",
  );
  if (closeError) {
    console.error("close_matched_change_suggestions failed:", closeError);
  }

  // Brief 53 §3 + Brief 55 tillæg A (17. sep 2026): map
  // branche_visma_tekst → branche_kode via brancher_lago. Match på
  // kode ("5", "05") og case-insensitive tekst-navn. "0" og tomme
  // bliver NULL — jf. Brief 55 §3a er "0" ikke en branche.
  //
  // Kaldes AFTER kunderækkerne er skrevet, så vi mapper de netop
  // opdaterede værdier. Fejler mappingen, mister vi ikke nogen data
  // — branche_visma_tekst er stadig sat, kun branche_kode mangler.
  let brancheMappedCount: number | null = null;
  try {
    const { data: mappedRes, error: mappedErr } =
      await supabase.rpc("map_branche_kode");
    if (mappedErr) {
      console.error("map_branche_kode failed:", mappedErr);
    } else {
      brancheMappedCount = typeof mappedRes === "number" ? mappedRes : null;
    }
  } catch (e) {
    console.error("map_branche_kode threw:", e);
  }

  await logSyncRun({
    datasaet: "customers",
    raekker: payload.length,
    er_testdata,
    note: `${er_testdata ? "testdata" : "driftsdata"} · created=${n_created} updated=${n_updated} · derive: ${JSON.stringify(deriveResult ?? {})} · forslag lukket: ${closedCount ?? 0} · branche mappet: ${brancheMappedCount ?? "n/a"}`,
    koert_af,
  });

  return { rowsWritten: payload.length };
}

// -------------------- Åbne ordrer --------------------

export async function importAabneOrdrer(
  payload: AabneOrdrerPayload,
  er_testdata: boolean,
  koert_af: number | null,
): Promise<{ rowsWritten: number }> {
  const supabase = getSupabaseClient();

  // Åbne ordrer ERSTATTES helt — en ordre der ikke længere er åben skal
  // forsvinde. Undtagelsen fra "import sletter aldrig". Vi sletter alt
  // og indsætter det nye i én sekvens (Supabase har ikke transaktioner
  // via SDK; det er OK fordi RLS forhindrer andre skrivere, og
  // synk-status-linjen viser når kørslen er færdig).
  //
  // NB: hvis vi kører drift-import, sletter vi også eksisterende
  // testdata (og vice versa). Det er by design — åbne ordrer er ét
  // snapshot; man har ikke to samtidige gyldige sæt.
  const { error: delErr } = await supabase
    .from("open_orders_lago")
    .delete()
    .neq("ordre_nr", "__never_matches__");
  if (delErr) throw delErr;

  await inBatches(payload, async (batch) => {
    const rows = batch.map((r) => ({
      ...r,
      er_testdata,
      kilde: "import" as const,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("open_orders_lago").insert(rows);
    if (error) throw error;
  });

  const daterne = payload.map((r) => r.ordre_dato).sort();
  await logSyncRun({
    datasaet: "open_orders",
    raekker: payload.length,
    er_testdata,
    periode_fra: daterne[0] ?? null,
    periode_til: daterne[daterne.length - 1] ?? null,
    note: er_testdata ? "testdata" : "driftsdata",
    koert_af,
  });

  return { rowsWritten: payload.length };
}

// -------------------- Produkter --------------------

export interface ImportProgress {
  phase: "lookup" | "upsert" | "done";
  currentChunk: number;
  totalChunks: number;
  rowsWrittenSoFar: number;
}

export async function importProdukter(
  payload: ProdukterPayload,
  er_testdata: boolean,
  koert_af: number | null,
  onProgress?: (p: ImportProgress) => void,
): Promise<{
  rowsWritten: number;
  retained_status7: number;
  currentTotalInTable: number;
}> {
  const supabase = getSupabaseClient();

  // Chunked lookup — se chunkedLookup() øverst i filen. 5.070 IDs i
  // én .in() giver "TypeError: Load failed" (URL for lang).
  const produktnre = payload.map((r) => r.produktnr);
  onProgress?.({
    phase: "lookup",
    currentChunk: 0,
    totalChunks: Math.ceil(produktnre.length / LOOKUP_CHUNK_SIZE),
    rowsWrittenSoFar: 0,
  });

  let existing: { produktnr: string; status: string | null }[];
  try {
    existing = await chunkedLookup<{
      produktnr: string;
      status: string | null;
    }>({
      table: "products_lago",
      keyColumn: "produktnr",
      keys: produktnre,
      select: "produktnr, status",
    });
  } catch (err) {
    // Ret feltet så det siger noget brugbart, ikke bare "Load failed".
    const currentCount = await countInTable("products_lago");
    throw new Error(
      `Kunne ikke slå eksisterende produkter op inden import (0 rækker skrevet). ` +
        `${currentCount} varer står i products_lago før forsøget. ` +
        `Prøv igen — filen kan uploades uændret. Detaljer: ${(err as Error).message}`,
    );
  }
  const existingStatus = new Map<string, string | null>();
  for (const row of existing) {
    if (row.produktnr) existingStatus.set(row.produktnr, row.status ?? null);
  }

  const startsWith7 = (s: string | null | undefined) =>
    !!s && /^7(\D|$)/.test(s.trim());

  let retained_status7 = 0;

  const toUpsert = payload.filter((r) => {
    const currentStatus = existingStatus.get(r.produktnr);
    if (startsWith7(currentStatus) && !startsWith7(r.status)) {
      retained_status7++;
      return false;
    }
    return true;
  });

  let rowsWrittenSoFar = 0;
  try {
    await inBatches(toUpsert, async (batch, batchIdx, totalBatches) => {
      onProgress?.({
        phase: "upsert",
        currentChunk: batchIdx + 1,
        totalChunks: totalBatches,
        rowsWrittenSoFar,
      });
      const rows = batch.map((r) => ({
        ...r,
        er_testdata,
        kilde: "import" as const,
        synced_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("products_lago")
        .upsert(rows, { onConflict: "produktnr" });
      if (error) throw error;
      rowsWrittenSoFar += batch.length;
    });
  } catch (err) {
    const currentCount = await countInTable("products_lago");
    throw new Error(
      `Upsert fejlede efter ${rowsWrittenSoFar} af ${toUpsert.length} rækker. ` +
        `${currentCount} varer står i products_lago nu. ` +
        `Kør igen — upsert er idempotent, så allerede-skrevne rækker påvirkes ikke. Detaljer: ${(err as Error).message}`,
    );
  }

  await logSyncRun({
    datasaet: "products",
    raekker: toUpsert.length,
    er_testdata,
    note: `${er_testdata ? "testdata" : "driftsdata"} · retained_status7=${retained_status7}`,
    koert_af,
  });

  const currentTotalInTable = await countInTable("products_lago");
  onProgress?.({
    phase: "done",
    currentChunk: 0,
    totalChunks: 0,
    rowsWrittenSoFar: toUpsert.length,
  });

  return {
    rowsWritten: toUpsert.length,
    retained_status7,
    currentTotalInTable,
  };
}

async function countInTable(table: string): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return -1;
  }
}

// -------------------- Produktgruppe-filter fra settings --------------

export async function fetchAcceptedProductGroups(): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("lago_settings")
    .select("value")
    .eq("key", "sales_product_groups")
    .maybeSingle<{ value: { groups: number[] } }>();
  if (error) throw error;
  const groups = data?.value?.groups ?? [];
  // Konverterer til string-set (parser sammenligner mod celltekst)
  return new Set(groups.map((g) => String(g)));
}

// -------------------- Ryd alle testdata --------------------

export async function resetTestdata(
  koert_af: number | null,
): Promise<{ deleted: number }> {
  const supabase = getSupabaseClient();

  const { count: smCount, error: smErr } = await supabase
    .from("sales_monthly_lago")
    .delete({ count: "exact" })
    .eq("er_testdata", true);
  if (smErr) throw smErr;

  const { count: ooCount, error: ooErr } = await supabase
    .from("open_orders_lago")
    .delete({ count: "exact" })
    .eq("er_testdata", true);
  if (ooErr) throw ooErr;

  const { count: pCount, error: pErr } = await supabase
    .from("products_lago")
    .delete({ count: "exact" })
    .eq("er_testdata", true);
  if (pErr) throw pErr;

  const deleted = (smCount ?? 0) + (ooCount ?? 0) + (pCount ?? 0);

  // Loggen skal ikke selv markeres som testdata — det er en handling,
  // ikke data. Vi noterer detaljerne i note-feltet.
  await logSyncRun({
    datasaet: "sales_monthly",
    raekker: deleted,
    er_testdata: false,
    note: `Ryd testdata: ${smCount ?? 0} sales_monthly + ${ooCount ?? 0} open_orders + ${pCount ?? 0} products slettet`,
    koert_af,
  });

  return { deleted };
}

// -------------------- Fetch CRM-kundenumre + distrikt-lookup --------

export interface CrmCustomerLookup {
  customers: Set<string>;
  district: Map<string, string | null>;
}

export async function fetchCrmCustomerLookup(): Promise<CrmCustomerLookup> {
  const supabase = getSupabaseClient();
  const all: { visma_customer_no: string; distrikt: string | null }[] = [];
  let from = 0;
  const step = 1000;
  // Paginer for at få alle rækker (Supabase default limit er 1000)
  while (true) {
    const { data, error } = await supabase
      .from("companies_lago")
      .select("visma_customer_no, distrikt")
      .not("visma_customer_no", "is", null)
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(
      ...(data as { visma_customer_no: string; distrikt: string | null }[]),
    );
    if (data.length < step) break;
    from += step;
  }

  const customers = new Set<string>();
  const district = new Map<string, string | null>();
  for (const row of all) {
    customers.add(row.visma_customer_no);
    district.set(row.visma_customer_no, row.distrikt);
  }
  return { customers, district };
}

// -------------------- Kontakter (Domain-brief 29) --------------------
//
// Engangsimport. Kontakter må IKKE i det natlige flow — CRM'et er
// master fra 16. sep 2026. Denne funktion kaldes én gang som fundament;
// derefter vedligeholdes kontakter i CRM'et.
//
// Match-strategi:
//   1. Har kontakten en visma_aktoer_nr → find eksisterende contacts_lago
//      med samme nr. Match → UPDATE. Ellers → INSERT ny.
//   2. Uden visma_aktoer_nr → find contact på samme company_id med
//      case-insensitive fornavn + efternavn. Match → UPDATE (skriv
//      visma-metadata på). Ellers → INSERT ny.
//
// Idempotent: to kørsler af samme fil skaber ingen dubletter.

/** Hent aktoer_nr → company_id fra companies_lago. Bruges af
 *  parseKontakter til at bygge companyLookupByAktoerNr på tørløbstidspunkt. */
export async function fetchCompanyAktoerLookup(): Promise<
  Map<string, { company_id: number; kunde_navn: string }>
> {
  const supabase = getSupabaseClient();
  const out = new Map<string, { company_id: number; kunde_navn: string }>();
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("companies_lago")
      .select("company_id, visma_aktoer_nr, companies!inner(name)")
      .not("visma_aktoer_nr", "is", null)
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const raw of data as Array<{
      company_id: number;
      visma_aktoer_nr: string;
      companies: { name: string } | { name: string }[];
    }>) {
      const nameSrc = Array.isArray(raw.companies)
        ? raw.companies[0]
        : raw.companies;
      out.set(raw.visma_aktoer_nr, {
        company_id: raw.company_id,
        kunde_navn: nameSrc?.name ?? "",
      });
    }
    if (data.length < step) break;
    from += step;
  }
  return out;
}

export async function importKontakter(
  payload: KontakterPayload,
  koert_af: number | null,
  onProgress?: (msg: string) => void,
): Promise<{
  n_created: number;
  n_updated: number;
  n_kunder_touched: number;
}> {
  const supabase = getSupabaseClient();

  // 1) Slå aktoer_nr → company_id op igen (parseren har brugt samme
  //    map, men det er ikke persisteret her — genfetch for at være
  //    robust hvis import kaldes selvstændigt).
  const companyByAktoer = await fetchCompanyAktoerLookup();

  // 2) Find eksisterende kontakter der matcher enten via kontaktens
  //    visma_aktoer_nr eller via (company_id + navn).
  const kontaktAktoerNumre = payload
    .map((r) => r.kontakt_aktoer_nr)
    .filter((v): v is string => !!v);

  interface ExistingByAktoer {
    contact_id: number;
    visma_aktoer_nr: string;
    contacts:
      | {
          id: number;
          company_id: number | null;
          first_name: string | null;
          last_name: string | null;
        }
      | {
          id: number;
          company_id: number | null;
          first_name: string | null;
          last_name: string | null;
        }[];
  }
  const existingByAktoerList = kontaktAktoerNumre.length
    ? await chunkedLookup<ExistingByAktoer>({
        table: "contacts_lago",
        keyColumn: "visma_aktoer_nr",
        keys: kontaktAktoerNumre,
        select:
          "contact_id, visma_aktoer_nr, contacts!inner(id, company_id, first_name, last_name)",
      })
    : [];
  const existingByAktoer = new Map<string, number>(); // aktoer_nr → contact_id
  for (const row of existingByAktoerList) {
    if (row.visma_aktoer_nr) {
      existingByAktoer.set(row.visma_aktoer_nr, row.contact_id);
    }
  }

  // Til navnesporing under fallback: hent alle contacts i berørte
  // kunder én gang, så vi kan matche uden N round-trips.
  const beroerteCompanyIds = new Set<number>();
  for (const r of payload) {
    const match = companyByAktoer.get(r.kunde_aktoer_nr);
    if (match) beroerteCompanyIds.add(match.company_id);
  }
  interface ExistingContact {
    id: number;
    company_id: number;
    first_name: string | null;
    last_name: string | null;
  }
  const contactsByCompanyName = new Map<string, number>(); // "companyId|firstlower|lastlower" → contact_id
  if (beroerteCompanyIds.size > 0) {
    const ids = Array.from(beroerteCompanyIds).map(String);
    const rows = await chunkedLookup<ExistingContact>({
      table: "contacts",
      keyColumn: "company_id",
      keys: ids,
      select: "id, company_id, first_name, last_name",
    });
    for (const c of rows) {
      const key = `${c.company_id}|${(c.first_name ?? "").trim().toLowerCase()}|${(c.last_name ?? "").trim().toLowerCase()}`;
      contactsByCompanyName.set(key, c.id);
    }
  }

  let n_created = 0;
  let n_updated = 0;
  const kunderTouched = new Set<number>();
  const now = new Date().toISOString();

  // Sekventiel loop for tydelige fejl per row. Volumen er lille (439).
  for (let i = 0; i < payload.length; i++) {
    const r = payload[i];
    if (onProgress && i % 50 === 0) {
      onProgress(`Importerer kontakt ${i + 1} af ${payload.length}…`);
    }
    const match = companyByAktoer.get(r.kunde_aktoer_nr);
    if (!match) continue; // parseren har allerede talt disse; her skipper vi.
    const companyId = match.company_id;
    kunderTouched.add(companyId);

    // 1) Try dedupe by kontaktens visma_aktoer_nr.
    let contactId: number | null = r.kontakt_aktoer_nr
      ? (existingByAktoer.get(r.kontakt_aktoer_nr) ?? null)
      : null;

    // 2) Fallback: same company + case-insensitive name.
    if (contactId == null) {
      const key = `${companyId}|${r.fornavn.trim().toLowerCase()}|${(r.efternavn ?? "").trim().toLowerCase()}`;
      contactId = contactsByCompanyName.get(key) ?? null;
    }

    // Byg patch til contacts (kernefelter).
    const emailJsonb = r.email ? [{ email: r.email, type: "Work" }] : [];
    const phoneJsonb: Array<{ number: string; type: string }> = [];
    if (r.mobiltelefon)
      phoneJsonb.push({ number: r.mobiltelefon, type: "Mobile" });
    if (r.telefon) phoneJsonb.push({ number: r.telefon, type: "Work" });

    if (contactId != null) {
      // UPDATE. "Overskriv ikke med tomt" — kun sæt felter der har
      // værdi, så CRM-rettelser bevares hvis VISMA er tom.
      const contactPatch: Record<string, unknown> = {};
      if (r.fornavn) contactPatch.first_name = r.fornavn;
      if (r.efternavn) contactPatch.last_name = r.efternavn;
      if (r.titel) contactPatch.title = r.titel;
      if (emailJsonb.length > 0) contactPatch.email_jsonb = emailJsonb;
      if (phoneJsonb.length > 0) contactPatch.phone_jsonb = phoneJsonb;
      if (Object.keys(contactPatch).length > 0) {
        const { error } = await supabase
          .from("contacts")
          .update(contactPatch)
          .eq("id", contactId);
        if (error) throw error;
      }

      // UPSERT contacts_lago (kan mangle for kontakter oprettet CRM-native).
      const lagoPatch: Record<string, unknown> = {
        contact_id: contactId,
        last_visma_import_at: now,
        updated_at: now,
      };
      if (r.kontakt_aktoer_nr) lagoPatch.visma_aktoer_nr = r.kontakt_aktoer_nr;
      lagoPatch.is_webshop_user = r.is_webshop;
      if (r.visma_created_by) lagoPatch.visma_created_by = r.visma_created_by;
      if (r.visma_created_at)
        lagoPatch.visma_created_at = `${r.visma_created_at}T12:00:00Z`;
      if (r.visma_updated_by) lagoPatch.visma_updated_by = r.visma_updated_by;
      if (r.visma_updated_at)
        lagoPatch.visma_updated_at = `${r.visma_updated_at}T12:00:00Z`;
      const { error: lagoErr } = await supabase
        .from("contacts_lago")
        .upsert(lagoPatch, { onConflict: "contact_id" });
      if (lagoErr) throw lagoErr;
      n_updated++;
    } else {
      // INSERT ny contact.
      const insertRes = await supabase
        .from("contacts")
        .insert({
          first_name: r.fornavn,
          last_name: r.efternavn,
          title: r.titel,
          company_id: companyId,
          email_jsonb: emailJsonb,
          phone_jsonb: phoneJsonb,
          tags: [],
          first_seen: r.visma_created_at
            ? `${r.visma_created_at}T12:00:00Z`
            : now,
          last_seen: now,
        })
        .select("id")
        .single<{ id: number }>();
      if (insertRes.error) throw insertRes.error;
      const newId = insertRes.data.id;

      // Skriv contacts_lago.
      const { error: lagoErr } = await supabase.from("contacts_lago").insert({
        contact_id: newId,
        visma_aktoer_nr: r.kontakt_aktoer_nr,
        is_webshop_user: r.is_webshop,
        visma_created_by: r.visma_created_by,
        visma_created_at: r.visma_created_at
          ? `${r.visma_created_at}T12:00:00Z`
          : null,
        visma_updated_by: r.visma_updated_by,
        visma_updated_at: r.visma_updated_at
          ? `${r.visma_updated_at}T12:00:00Z`
          : null,
        last_visma_import_at: now,
      });
      if (lagoErr) throw lagoErr;
      n_created++;
    }
  }

  // Log som sync_run. Datasæt-værdien "customers" er nærmeste eksisterende
  // enum; note-feltet skelner mellem kunder og kontakter.
  await logSyncRun({
    datasaet: "customers",
    raekker: n_created + n_updated,
    er_testdata: false,
    note: `Engangsimport kontakter: ${n_created} oprettet + ${n_updated} opdateret på ${kunderTouched.size} kunder`,
    koert_af,
  });

  return {
    n_created,
    n_updated,
    n_kunder_touched: kunderTouched.size,
  };
}
