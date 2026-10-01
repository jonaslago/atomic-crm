/**
 * §95-2: Server-side import logic for the auto-import Edge Function.
 *
 * Each importer takes a Uint8Array (XLSX bytes) and the admin Supabase
 * client, parses the file using the shared Excel reader, runs gates
 * (§95 §4), and writes to the database.
 *
 * The parsers here mirror src/lago/settings/salesImport/parsers/* but
 * run in Deno with the admin client. We inline the critical logic
 * rather than importing from src/ (different module system).
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  readExcelGridFromBytes,
  findHeaderRow,
  buildHeaderMap,
  findFirstHeader,
  checkRequiredColumnAliases,
  cellString,
  cellNumber,
  cellDate,
  cellCode,
} from "./excelReader.ts";

// ---------- Types ----------

export interface ImportResult {
  ok: boolean;
  rowsInFile: number;
  rowsImported: number;
  gateFailure?: string;
  detail?: string;
}

// ---------- Gates (§95 §4) ----------

interface GateInput {
  datasaet: string;
  rowsInFile: number;
  rowsAfterFilter: number;
  totalBelob?: number;
  matchedCustomers?: number;
  totalCustomers?: number;
}

async function checkGates(
  supabase: SupabaseClient,
  input: GateInput,
): Promise<string | null> {
  // Gate: zero rows
  if (input.rowsInFile === 0) return "Nul rækker i filen";
  if (input.rowsAfterFilter === 0) return "Nul rækker efter filtrering";

  // Gate: row count deviation ±30% from last successful AUTO-import.
  // Compares only against kilde='auto-import' — a manual full-file
  // import (42k rows) must not gate a 7-day file (500 rows).
  const { data: lastRun } = await supabase
    .from("sync_runs_lago")
    .select("raekker")
    .eq("datasaet", input.datasaet)
    .eq("kilde", "auto-import")
    .not("note", "ilike", "%fejlet%")
    .order("koert_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Skip gate if no prior auto-import baseline exists (first run with
  // new file size will establish the baseline for subsequent runs).
  if (lastRun && typeof lastRun.raekker === "number" && lastRun.raekker > 0) {
    const pct =
      Math.abs(input.rowsAfterFilter - lastRun.raekker) / lastRun.raekker;
    if (pct > 0.3) {
      return `Rækketærskel: ${input.rowsAfterFilter} rækker mod ${lastRun.raekker} sidst (${(pct * 100).toFixed(0)}% afvigelse, max 30%)`;
    }
  }

  // Gate: customer recognition rate (if applicable)
  if (
    input.matchedCustomers != null &&
    input.totalCustomers != null &&
    input.totalCustomers > 0
  ) {
    const rate = input.matchedCustomers / input.totalCustomers;
    // Compare against last run's rate — not absolute threshold
    // For simplicity, use absolute: must be > 50%
    if (rate < 0.5) {
      return `Kundegenkendelse: ${(rate * 100).toFixed(0)}% genkendt (min 50%)`;
    }
  }

  // Gate: produkttransaktioner total must never decrease (cumulative file)
  if (input.datasaet === "sales_monthly" && input.totalBelob != null) {
    const { data: lastTotal } = await supabase
      .from("sync_runs_lago")
      .select("note")
      .eq("datasaet", "sales_monthly")
      .not("note", "ilike", "%fejlet%")
      .order("koert_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastTotal?.note) {
      // Extract total from note if stored
      // For now, we skip this gate — it requires storing the total in a structured way
    }
  }

  return null; // All gates passed
}

// ---------- Produkttransaktioner ----------

const PT_COLUMNS: [string, ...string[]][] = [
  ["Kundenr", "Kundenr."],
  ["Fakturadato"],
  ["Beløb", "Beløb (kr)"],
  ["Produktgruppe"],
  ["Salgstype"],
  ["Produktnr", "Produktnr."],
  ["Antal"],
];

export async function importProdukttransaktioner(
  bytes: Uint8Array,
  supabase: SupabaseClient,
): Promise<ImportResult> {
  const grid = await readExcelGridFromBytes(bytes);

  // Find header row
  let headerRowIndex: number;
  try {
    try {
      headerRowIndex = findHeaderRow(grid, "Kundenr");
    } catch {
      headerRowIndex = findHeaderRow(grid, "Kundenr.");
    }
  } catch {
    return {
      ok: false,
      rowsInFile: 0,
      rowsImported: 0,
      gateFailure: "Header ikke fundet",
    };
  }

  const headerMap = buildHeaderMap(grid[headerRowIndex]);
  const missing = checkRequiredColumnAliases(headerMap, PT_COLUMNS);
  if (missing.length > 0) {
    return {
      ok: false,
      rowsInFile: 0,
      rowsImported: 0,
      gateFailure: `Manglende kolonner: ${missing.join(", ")}`,
    };
  }

  // Fetch accepted product groups
  const { data: pgData } = await supabase
    .from("lago_settings")
    .select("value")
    .eq("key", "sales_product_groups")
    .maybeSingle();
  const acceptedGroups = new Set<string>(
    ((pgData?.value as { groups?: number[] })?.groups ?? []).map(String),
  );

  // Fetch customer lookup (district filter)
  const districtMap = new Map<string, string | null>();
  let from = 0;
  const step = 1000;
  while (true) {
    const { data } = await supabase
      .from("companies_lago")
      .select("visma_customer_no, distrikt")
      .not("visma_customer_no", "is", null)
      .range(from, from + step - 1);
    if (!data || data.length === 0) break;
    for (const r of data as Array<{
      visma_customer_no: string;
      distrikt: string | null;
    }>) {
      districtMap.set(r.visma_customer_no, r.distrikt);
    }
    if (data.length < step) break;
    from += step;
  }

  // Parse
  const idx = {
    kundenr: findFirstHeader(headerMap, ["Kundenr", "Kundenr."]),
    fakturadato: headerMap.get("Fakturadato")!,
    belob: findFirstHeader(headerMap, ["Beløb", "Beløb (kr)"]),
    produktgruppe: headerMap.get("Produktgruppe")!,
    salgstype: headerMap.get("Salgstype")!,
    produktnr: findFirstHeader(headerMap, ["Produktnr", "Produktnr."]),
    antal: headerMap.get("Antal")!,
    forbrugt: findFirstHeader(headerMap, ["Forbrugt"]),
    kampagne: headerMap.get("Kampagne") ?? -1,
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  // §28/§96: daily grain. Key includes fakturadato.
  const aggregated = new Map<
    string,
    {
      visma_customer_no: string;
      aar: number;
      maaned: number;
      fakturadato: string;
      produktnr: string;
      salgstype: string;
      belob: number;
      antal: number;
      forbrugt: number;
      kampagne: string | null;
    }
  >();
  let rowsSeen = 0;
  let totalBelob = 0;

  for (const row of rawRows) {
    if (!row || row.every((c: unknown) => c == null || c === "")) continue;
    rowsSeen++;

    const kundenr = cellString(row[idx.kundenr]);
    if (!kundenr) continue;

    const pgCode = cellCode(row[idx.produktgruppe]);
    if (!pgCode || !acceptedGroups.has(pgCode)) continue;

    if (!districtMap.has(kundenr)) continue;
    const distrikt = districtMap.get(kundenr);
    if (distrikt !== "Øst" && distrikt !== "Vest" && distrikt !== "HQ")
      continue;

    const dateStr = cellDate(row[idx.fakturadato]);
    if (!dateStr) continue;
    const [yStr, mStr] = dateStr.split("-");
    const aar = Number(yStr);
    const maaned = Number(mStr);

    const belob = cellNumber(row[idx.belob]) ?? 0;
    const antal = cellNumber(row[idx.antal]) ?? 0;
    const forbrugt =
      idx.forbrugt >= 0 ? (cellNumber(row[idx.forbrugt]) ?? 0) : 0;
    const salgstype = cellString(row[idx.salgstype]) ?? "";
    const produktnr = cellString(row[idx.produktnr]) ?? "";
    const kampagne = idx.kampagne >= 0 ? cellString(row[idx.kampagne]) : null;

    // §28/§96: daily grain key includes fakturadato.
    const key = `${kundenr}|${dateStr}|${produktnr}|${salgstype}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.belob += belob;
      existing.antal += antal;
      existing.forbrugt += forbrugt;
    } else {
      aggregated.set(key, {
        visma_customer_no: kundenr,
        aar,
        maaned,
        fakturadato: dateStr,
        produktnr,
        salgstype,
        belob,
        antal,
        forbrugt,
        kampagne,
      });
    }
    totalBelob += belob;
  }

  const payload = [...aggregated.values()];

  // Gates
  const gateFailure = await checkGates(supabase, {
    datasaet: "sales_monthly",
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    totalBelob,
  });
  if (gateFailure) {
    return { ok: false, rowsInFile: rowsSeen, rowsImported: 0, gateFailure };
  }

  // 🔴 RULE (§95, 1. okt 2026): sales_monthly_lago is UPSERT ONLY.
  // NEVER DELETE. The file may contain only 7 days of data (hourly job),
  // but the table holds three years of revenue history from 2024-01-01.
  // A DELETE would wipe the entire history because the file is a window,
  // not a snapshot. This is different from open_orders_lago, which IS a
  // snapshot and uses transactional replace (replace_open_orders RPC).
  //
  //   open_orders_lago + notes  → replace entire table, one transaction
  //   sales_monthly_lago        → upsert only, never delete
  //
  const BATCH = 500;
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH).map((r) => ({
      ...r,
      er_testdata: false,
      kilde: "auto-import" as const,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("sales_monthly_lago").upsert(batch, {
      onConflict:
        "visma_customer_no,aar,maaned,produktnr,salgstype,fakturadato",
    });
    if (error) throw error;
  }

  return {
    ok: true,
    rowsInFile: rowsSeen,
    rowsImported: payload.length,
    detail: `${rowsSeen} i filen · ${payload.length} skrevet · ${totalBelob.toFixed(0)} kr.`,
  };
}

// ---------- Åbne ordrer ----------

// Purchase-order status codes that must never land in the sales table.
const INDKOEBS_STATUS_KODER = new Set(["11", "12", "13", "14"]);

const OO_COLUMNS: [string, ...string[]][] = [
  ["Ordrenr", "Ordrenr."],
  ["Linienr", "Linjenr.", "Linjenr"],
  ["Kundenr", "Kundenr."],
  ["Ordredato"],
  ["Ordrestatus", "Status"],
  ["Levering", "Ordreart"],
  ["Ønsket lev. Dato", "Ønsket leveringsdato"],
  ["Produktnr", "Produktnr."],
  ["Produktgruppe"],
  ["Salgstype"],
  ["Antal"],
  ["Beløb", "Ej faktureret"],
];

export async function importAabneOrdrer(
  ordreBytes: Uint8Array,
  noteBytes: Uint8Array | null,
  supabase: SupabaseClient,
): Promise<ImportResult> {
  // ---- Parse ordrer ----
  const ordreGrid = await readExcelGridFromBytes(ordreBytes);
  let headerIdx: number;
  try {
    try {
      headerIdx = findHeaderRow(ordreGrid, "Ordrenr");
    } catch {
      headerIdx = findHeaderRow(ordreGrid, "Ordrenr.");
    }
  } catch {
    return {
      ok: false,
      rowsInFile: 0,
      rowsImported: 0,
      gateFailure: "Ordre-header ikke fundet",
    };
  }

  const headerMap = buildHeaderMap(ordreGrid[headerIdx]);
  const missing = checkRequiredColumnAliases(headerMap, OO_COLUMNS);
  if (missing.length > 0) {
    return {
      ok: false,
      rowsInFile: 0,
      rowsImported: 0,
      gateFailure: `Manglende kolonner: ${missing.join(", ")}`,
    };
  }

  // District lookup — same pattern as importProdukttransaktioner.
  const districtMap = new Map<string, string | null>();
  let from = 0;
  const step = 1000;
  while (true) {
    const { data } = await supabase
      .from("companies_lago")
      .select("visma_customer_no, distrikt")
      .not("visma_customer_no", "is", null)
      .range(from, from + step - 1);
    if (!data || data.length === 0) break;
    for (const r of data as Array<{
      visma_customer_no: string;
      distrikt: string | null;
    }>) {
      districtMap.set(r.visma_customer_no, r.distrikt);
    }
    if (data.length < step) break;
    from += step;
  }

  const idx = {
    ordrenr: findFirstHeader(headerMap, ["Ordrenr", "Ordrenr."]),
    linjenr: findFirstHeader(headerMap, ["Linienr", "Linjenr.", "Linjenr"]),
    kundenr: findFirstHeader(headerMap, ["Kundenr", "Kundenr."]),
    ordredato: headerMap.get("Ordredato")!,
    status: findFirstHeader(headerMap, ["Ordrestatus", "Status"]),
    levering: findFirstHeader(headerMap, ["Levering", "Ordreart"]),
    oensket_lev: findFirstHeader(headerMap, [
      "Ønsket lev. Dato",
      "Ønsket leveringsdato",
    ]),
    produktnr: findFirstHeader(headerMap, ["Produktnr", "Produktnr."]),
    produktgruppe: headerMap.get("Produktgruppe")!,
    kundeprisgruppe: headerMap.get("Kundeprisgruppe 1") ?? -1,
    salgstype: headerMap.get("Salgstype")!,
    antal: headerMap.get("Antal")!,
    antal_faerdigmeldt: findFirstHeader(headerMap, [
      "Antal færdigmeldt",
      "Antal faerdigmeldt",
    ]),
    reserveret_mod_lager: findFirstHeader(headerMap, [
      "Reserveret mod lager",
      "Reserveret mod. lager",
    ]),
    forbrugt: findFirstHeader(headerMap, ["Forbrugt"]),
    belob: findFirstHeader(headerMap, ["Beløb", "Ej faktureret"]),
    kampagne: headerMap.get("Kampagne") ?? -1,
    saelger: findFirstHeader(headerMap, ["Sælger", "Sælger/indkøber"]),
    faerdigmelding: headerMap.get("Færdigmeldingsdato") ?? -1,
    sellerno: headerMap.get("Sellerno") ?? -1,
    undtages: findFirstHeader(headerMap, [
      "Undtages lagerhåndtering",
      "Undtages lagerhaandtering",
    ]),
    note: findFirstHeader(headerMap, ["Note"]),
  };

  const rawRows = ordreGrid.slice(headerIdx + 1);
  // deno-lint-ignore no-explicit-any
  const orderPayload: any[] = [];
  let rowsSeen = 0;

  for (const row of rawRows) {
    if (!row || row.every((c: unknown) => c == null || c === "")) continue;
    rowsSeen++;

    const ordrenr = cellString(row[idx.ordrenr]);
    const linjenr = cellString(row[idx.linjenr]);
    const kundenr = cellString(row[idx.kundenr]);
    if (!ordrenr || !linjenr || !kundenr) continue;

    const statusCode = cellCode(row[idx.status]);
    if (statusCode && INDKOEBS_STATUS_KODER.has(statusCode)) continue;

    if (!districtMap.has(kundenr)) continue;
    const distrikt = districtMap.get(kundenr);
    if (distrikt !== "Øst" && distrikt !== "Vest" && distrikt !== "HQ")
      continue;

    const ordredato = cellDate(row[idx.ordredato]);
    if (!ordredato) continue;

    const antal = cellNumber(row[idx.antal]) ?? 0;
    const antal_faerdigmeldt =
      idx.antal_faerdigmeldt >= 0
        ? (cellNumber(row[idx.antal_faerdigmeldt]) ?? 0)
        : 0;
    const reserveret_mod_lager =
      idx.reserveret_mod_lager >= 0
        ? cellNumber(row[idx.reserveret_mod_lager])
        : null;
    const rml = reserveret_mod_lager ?? 0;
    const lagerstatus =
      rml >= antal ? "klar" : rml > 0 ? "delvis" : "restordre";
    const rest = antal - rml;
    const leveringRaw = cellString(row[idx.levering]);
    const leveringCode = cellCode(row[idx.levering]);
    const mav = leveringCode === "1";
    const oensket_leveringsdato = cellDate(row[idx.oensket_lev]);
    const har_oensket_dato = oensket_leveringsdato !== null;

    orderPayload.push({
      ordre_nr: ordrenr,
      linje_nr: linjenr,
      visma_customer_no: kundenr,
      ordre_dato: ordredato,
      ordreart: null,
      levering: leveringRaw,
      status: cellString(row[idx.status]),
      kampagne: idx.kampagne >= 0 ? cellString(row[idx.kampagne]) : null,
      saelger: idx.saelger >= 0 ? cellString(row[idx.saelger]) : null,
      produktnr: cellString(row[idx.produktnr]),
      produktgruppe: cellString(row[idx.produktgruppe]),
      kundeprisgruppe:
        idx.kundeprisgruppe >= 0 ? cellString(row[idx.kundeprisgruppe]) : null,
      salgstype: cellString(row[idx.salgstype]),
      antal,
      antal_faerdigmeldt,
      rest,
      i_rest: null,
      ej_faktureret: cellNumber(row[idx.belob]) ?? 0,
      oensket_leveringsdato,
      faerdigmeldingsdato:
        idx.faerdigmelding >= 0 ? cellDate(row[idx.faerdigmelding]) : null,
      sellerno: idx.sellerno >= 0 ? cellString(row[idx.sellerno]) : null,
      reserveret_mod_lager,
      lagerstatus,
      mav,
      har_oensket_dato,
      forbrugt: idx.forbrugt >= 0 ? cellNumber(row[idx.forbrugt]) : null,
      note: idx.note >= 0 ? cellString(row[idx.note]) : null,
      undtages_lagerhaandtering:
        idx.undtages >= 0 && cellCode(row[idx.undtages]) === "1",
      er_testdata: false,
      kilde: "import",
    });
  }

  // ---- Parse noter ----
  // deno-lint-ignore no-explicit-any
  const notePayload: any[] = [];
  let notesInFile = 0;
  if (noteBytes) {
    const noteGrid = await readExcelGridFromBytes(noteBytes);
    let noteHeaderIdx: number;
    try {
      noteHeaderIdx = findHeaderRow(noteGrid, "Ordrenr");
    } catch {
      return {
        ok: false,
        rowsInFile: rowsSeen,
        rowsImported: 0,
        gateFailure: "Note-header ikke fundet",
      };
    }
    const noteMap = buildHeaderMap(noteGrid[noteHeaderIdx]);
    const noteIdx = {
      ordrenr: noteMap.get("Ordrenr")!,
      linjenr:
        noteMap.get("Linienr") ??
        noteMap.get("Linjenr") ??
        noteMap.get("Linjenr.") ??
        -1,
      produktnr: noteMap.get("Produktnr") ?? -1,
      beskrivelse: noteMap.get("Beskrivelse") ?? -1,
      aendret_dato:
        noteMap.get("Ændret dato") ?? noteMap.get("Aendret dato") ?? -1,
    };
    if (noteIdx.linjenr < 0 || noteIdx.beskrivelse < 0) {
      return {
        ok: false,
        rowsInFile: rowsSeen,
        rowsImported: 0,
        gateFailure: "Note-kolonner mangler (Linienr/Beskrivelse)",
      };
    }

    const noteRows = noteGrid.slice(noteHeaderIdx + 1);
    for (const row of noteRows) {
      if (!row || row.every((c: unknown) => c == null || c === "")) continue;
      notesInFile++;
      const ordrenr = cellString(row[noteIdx.ordrenr]);
      const linjenr = cellString(row[noteIdx.linjenr]);
      const beskrivelse = cellString(row[noteIdx.beskrivelse]);
      if (!ordrenr || !linjenr || !beskrivelse) continue;
      const produktnrRaw =
        noteIdx.produktnr >= 0
          ? cellString(row[noteIdx.produktnr])?.toLowerCase()
          : null;
      if (produktnrRaw !== "inote" && produktnrRaw !== "enote") continue;
      notePayload.push({
        ordre_nr: ordrenr,
        linje_nr: linjenr,
        produktnr: cellString(row[noteIdx.produktnr]),
        note_type: produktnrRaw,
        beskrivelse,
        aendret_dato:
          noteIdx.aendret_dato >= 0
            ? cellDate(row[noteIdx.aendret_dato])
            : null,
      });
    }
  }

  // Gates
  const gateFailure = await checkGates(supabase, {
    datasaet: "open_orders",
    rowsInFile: rowsSeen,
    rowsAfterFilter: orderPayload.length,
  });
  if (gateFailure) {
    return { ok: false, rowsInFile: rowsSeen, rowsImported: 0, gateFailure };
  }

  // Call replace_open_orders RPC — transactional replace of both tables.
  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "replace_open_orders",
    { p_orders: orderPayload, p_notes: notePayload },
  );
  if (rpcErr) throw rpcErr;

  const result = rpcResult as {
    orders_inserted: number;
    notes_inserted: number;
  };

  return {
    ok: true,
    rowsInFile: rowsSeen,
    rowsImported: result.orders_inserted,
    detail: `${rowsSeen} i filen · ${result.orders_inserted} ordrer · ${result.notes_inserted} noter (${notesInFile} i notefilen)`,
  };
}

// ---------- Kunder ----------

export async function importKunder(
  _bytes: Uint8Array,
  _supabase: SupabaseClient,
): Promise<ImportResult> {
  // Simplified — full parser porting is a larger task
  return {
    ok: false,
    rowsInFile: 0,
    rowsImported: 0,
    gateFailure:
      "Kunde-import ikke implementeret i serverside endnu — bruges kun manuelt",
  };
}
