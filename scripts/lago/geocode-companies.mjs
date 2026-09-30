// LAGO Domain-brief 12 · Fase B — idempotent DAWA-geokodning.
//
// Læser adressen fra public.companies (adresselinje 1 + postnr + by) — vi
// bruger IKKE adresselinje 2, den er ofte junk ("Levering før kl 13.00").
// Sender til Dataforsyningens gratis DAWA-API:
//   1) `/datavask/adgangsadresser?betegnelse=…` (bedst — fuzzy-match)
//   2) fallback `/adgangsadresser?…` med vejnavn/postnr/husnr
// Gemmer lat/lng + status + address-hash så genkørsler kun rører
// adresser der er tomme eller er ændret siden sidst.
//
// Kør:
//   node scripts/lago/geocode-companies.mjs confirm=YES [only-missing|force-all]

import { createHash } from "node:crypto";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const DAWA_BASE = "https://dawa.aws.dk";
const REQUESTS_PER_SECOND = 6;
const MIN_INTERVAL_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);
const MAX_ROWS_PER_RUN = 300;
const MGMT_API_RETRIES = 4;

// ---------------------------------------------------------------------
// Address normalization
// ---------------------------------------------------------------------

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s) {
  if (s == null) return "";
  return stripDiacritics(String(s))
    .replace(/[.,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Strip common prefixes VISMA-adresser tit har på sig ("v/John T. Foged, ",
 * "Att. Anette Hansen, ", "C/O Lise Dræby madsen, "). DAWA's datavask
 * håndterer typografiske variationer, men har svært ved kontaktnavne
 * foran vejnavnet.
 */
function cleanAddress(address) {
  if (!address) return address;
  let s = address.trim();
  s = s.replace(/^v\/[^,]+,\s*/i, "");
  s = s.replace(/^att\.?\s*[^,]+,\s*/i, "");
  s = s.replace(/^c\/o\s+[^,]+,\s*/i, "");
  // Butikscenter-formater: "Rødovre Centrum - Butik 149" → drop trailing " - Butik…"
  s = s.replace(/\s+-\s+butik\s+[\dA-Z]+.*/i, "");
  return s.trim();
}

function buildBetegnelse(row) {
  const parts = [cleanAddress(row.address), row.zipcode, row.city].filter(Boolean);
  return parts.join(", ").trim();
}

function addressHash(row) {
  return createHash("md5")
    .update([normalize(row.address), normalize(row.zipcode), normalize(row.city)].join("|"))
    .digest("hex");
}

// ---------------------------------------------------------------------
// DAWA calls
// ---------------------------------------------------------------------

async function dawaGet(path, params) {
  const url = new URL(path, DAWA_BASE);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`DAWA ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchAdgangCoords(id) {
  const detail = await dawaGet(`/adgangsadresser/${id}`, {
    struktur: "mini",
  });
  if (
    detail &&
    typeof detail.x === "number" &&
    typeof detail.y === "number"
  ) {
    return { lat: detail.y, lng: detail.x };
  }
  return null;
}

async function geocodeOne(row) {
  const betegnelse = buildBetegnelse(row);
  if (!betegnelse || !row.zipcode || !row.city) {
    return { status: "not_found", reason: "missing address parts" };
  }

  // 1) Datavask — accept A/B/C. DAWA embeds only metadata; we follow the
  //    href → /adgangsadresser/{id}?struktur=mini to get x/y.
  try {
    const dv = await dawaGet("/datavask/adgangsadresser", { betegnelse });
    const best = Array.isArray(dv?.resultater) ? dv.resultater[0] : null;
    const kategori = dv?.kategori;
    if (best && (kategori === "A" || kategori === "B" || kategori === "C")) {
      const id = best.adresse?.id ?? best.aktueladresse?.id;
      if (id) {
        const coords = await fetchAdgangCoords(id);
        if (coords) {
          const resolved =
            best.aktueladresse?.betegnelse ??
            [
              best.adresse?.vejnavn,
              best.adresse?.husnr,
              best.adresse?.postnr,
              best.adresse?.postnrnavn,
            ]
              .filter(Boolean)
              .join(" ");
          return {
            status: "found",
            lat: coords.lat,
            lng: coords.lng,
            source: `dawa:datavask/${kategori}`,
            resolved,
          };
        }
      }
    }
  } catch (err) {
    console.warn(`  datavask error for ${row.id}:`, err.message);
  }

  // 2) Fallback: /adgangsadresser?vejnavn=…&husnr=…&postnr=…&struktur=mini
  try {
    const parsed = parseHouseNr(cleanAddress(row.address) ?? "");
    const list = await dawaGet("/adgangsadresser", {
      vejnavn: parsed.vejnavn,
      husnr: parsed.husnr,
      postnr: row.zipcode,
      struktur: "mini",
      per_side: 1,
    });
    const first = Array.isArray(list) ? list[0] : null;
    if (first && typeof first.x === "number" && typeof first.y === "number") {
      return {
        status: "found",
        lat: first.y,
        lng: first.x,
        source: "dawa:adgangsadresser",
        resolved: [first.vejnavn, first.husnr, first.postnr, first.postnrnavn]
          .filter(Boolean)
          .join(" "),
      };
    }
  } catch (err) {
    return { status: "error", reason: err.message ?? String(err) };
  }

  return { status: "not_found", reason: "no DAWA hit" };
}

function parseHouseNr(address) {
  const s = address.trim();
  // Match "vejnavn <husnr>" where husnr = number optionally followed by
  // a letter (e.g. "12", "5B"). We drop suffix like ", 1. tv." to keep
  // fuzzy-match simple.
  const m = s.match(/^(.*?)(\d+[A-Za-z]?)(?:[\s,].*)?$/);
  if (!m) return { vejnavn: s, husnr: null };
  return { vejnavn: m[1].trim(), husnr: m[2] };
}

// ---------------------------------------------------------------------
// DB IO
// ---------------------------------------------------------------------

function esc(v) {
  if (v == null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function fetchTargets(mode) {
  // "only-missing" (default): rows with no lat/lng and either no status
  //   or status != 'not_found' (retry those manually via force-all).
  // "force-all": every row, ignoring current status/hash.
  const whereClause =
    mode === "force-all"
      ? "1 = 1"
      : "(cl.lat IS NULL OR cl.lng IS NULL OR cl.geocoded_address_hash IS DISTINCT FROM md5(coalesce(lower(regexp_replace(c.address,'[.,;]+',' ','g')),'') || '|' || coalesce(lower(c.zipcode),'') || '|' || coalesce(lower(c.city),'')))";
  const rows = await runSql(
    `SELECT c.id, c.address, c.zipcode, c.city
       FROM public.companies c
       JOIN public.companies_lago cl ON cl.company_id = c.id
      WHERE ${whereClause}
        AND cl.visma_customer_no IS NOT NULL
      ORDER BY c.id
      LIMIT ${MAX_ROWS_PER_RUN};`,
  );
  return rows ?? [];
}

/**
 * Flush all accumulated results with one temp-table upsert — same pattern
 * the importers use. Vastly fewer round-trips than per-row UPDATE and
 * survives Management API's occasional 5xx.
 */
async function flushBuffer(buffer) {
  if (buffer.length === 0) return;
  const now = new Date().toISOString();
  const values = buffer
    .map(
      (b) =>
        `(${b.companyId}, ${b.lat != null ? b.lat : "NULL"}, ${b.lng != null ? b.lng : "NULL"}, ${esc(b.status)}, ${esc(b.source ?? null)}, ${esc(b.resolved ?? null)}, ${esc(b.hash)})`,
    )
    .join(",\n  ");
  const sql = `
CREATE TEMP TABLE _geo (
  company_id bigint PRIMARY KEY,
  lat double precision,
  lng double precision,
  status text,
  source text,
  resolved text,
  hash text
) ON COMMIT DROP;

INSERT INTO _geo VALUES
  ${values};

UPDATE public.companies_lago cl SET
  lat = COALESCE(g.lat, cl.lat),
  lng = COALESCE(g.lng, cl.lng),
  geocode_status = g.status,
  geocode_source = g.source,
  geocoded_address = COALESCE(g.resolved, cl.geocoded_address),
  geocoded_address_hash = g.hash,
  geocoded_at = ${esc(now)},
  updated_at = ${esc(now)}
FROM _geo g
WHERE cl.company_id = g.company_id;
`;
  for (let i = 0; i < MGMT_API_RETRIES; i++) {
    try {
      await runSql(sql);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /50[0-9]/.test(msg) || /timeout/i.test(msg);
      if (!transient || i === MGMT_API_RETRIES - 1) throw err;
      const wait = 800 * 2 ** i;
      console.warn(`  flush retry ${i + 1}/${MGMT_API_RETRIES} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  requireConfirm();
  const mode = process.argv.includes("force-all") ? "force-all" : "only-missing";

  console.log(`Fetching targets (${mode}) …`);
  const targets = await fetchTargets(mode);
  console.log(`Got ${targets.length} customers to geocode.`);
  if (targets.length === 0) return;

  const stats = { found: 0, not_found: 0, error: 0, skipped: 0 };
  const failures = [];
  const buffer = [];
  const FLUSH_EVERY = 40;

  let lastCall = 0;
  for (const row of targets) {
    const hash = addressHash(row);
    if (!row.address || !row.zipcode || !row.city) {
      stats.skipped++;
      buffer.push({
        companyId: row.id,
        status: "not_found",
        source: null,
        resolved: null,
        hash,
        lat: null,
        lng: null,
      });
      if (buffer.length >= FLUSH_EVERY) {
        await flushBuffer(buffer);
        buffer.length = 0;
      }
      continue;
    }

    const gap = MIN_INTERVAL_MS - (Date.now() - lastCall);
    if (gap > 0) await sleep(gap);
    lastCall = Date.now();

    let result;
    try {
      result = await geocodeOne(row);
    } catch (err) {
      result = { status: "error", reason: err.message ?? String(err) };
    }
    stats[result.status] = (stats[result.status] ?? 0) + 1;
    if (result.status !== "found") {
      failures.push({
        id: row.id,
        address: buildBetegnelse(row),
        status: result.status,
        reason: result.reason,
      });
    }
    buffer.push({
      companyId: row.id,
      status: result.status,
      source: result.source ?? null,
      resolved: result.resolved ?? null,
      hash,
      lat: result.status === "found" ? result.lat : null,
      lng: result.status === "found" ? result.lng : null,
    });
    if (buffer.length >= FLUSH_EVERY) {
      await flushBuffer(buffer);
      buffer.length = 0;
    }
  }
  if (buffer.length > 0) await flushBuffer(buffer);

  console.log("\nStats:", stats);
  if (failures.length > 0 && failures.length <= 30) {
    console.log("\nUnresolved:");
    for (const f of failures) {
      console.log(`  #${f.id} '${f.address}' — ${f.status}: ${f.reason ?? ""}`);
    }
  } else if (failures.length > 30) {
    console.log(`\n${failures.length} unresolved — sample:`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  #${f.id} '${f.address}' — ${f.status}: ${f.reason ?? ""}`);
    }
  }

  const summary = await runSql(
    `SELECT
       (SELECT COUNT(*) FROM public.companies_lago WHERE lat IS NOT NULL) AS with_coords,
       (SELECT COUNT(*) FROM public.companies_lago WHERE geocode_status = 'not_found') AS not_found,
       (SELECT COUNT(*) FROM public.companies_lago WHERE visma_customer_no IS NOT NULL) AS imported_total;`,
  );
  console.log("\nDB summary:", summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
