// LAGO Domain-brief 6 — idempotent VISMA-XLS contact importer.
//
// Reads the contact export (skip row 1, headers row 2, values are
// self-labelled), links each contact to the already-imported customer via
// `Kontaktperson for = kunde.Aktørnr`, and upserts on VISMA Aktørnr into
// public.contacts + public.contacts_lago. Contacts whose Kontaktperson
// for doesn't match any imported kunde are counted and skipped — they
// belong to filtered-out customers (Intern/HQ/Eksport/privat).
//
// Fields all classified VISMA-owned per fieldOwnership.CONTACT_FIELDS in
// brief 4, so we can refresh them safely on every re-import — CRM-owned
// contact fields (status, tags, background, has_newsletter, linkedin,
// sales_id, gender) are never touched here.
//
// Usage:
//   node scripts/lago/import-visma-contacts.mjs <path-to.xlsx> \
//     [dry-run] confirm=YES
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { requireConfirm, runSql } from "./supabaseAdmin.mjs";

// Column indices confirmed against `kontakter.xlsx` via inspect-xls.mjs.
const COL = {
  aktoer_nr: 0,
  navn: 1,
  kontaktperson_for: 108, // links to kunde.Aktørnr
  telefon: 188,
  mobil: 137,
  titel: 194,
  email: 221,
};

function nonEmpty(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "0") return null;
  return s;
}

function splitName(fullName) {
  const s = nonEmpty(fullName);
  if (!s) return { first_name: null, last_name: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function pickPhone(fixed, mobile) {
  return nonEmpty(fixed) ?? nonEmpty(mobile);
}

function emailJsonb(email) {
  return email ? [{ email, type: "Work" }] : null;
}

function phoneJsonb(number) {
  return number ? [{ number, type: "Work" }] : null;
}

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------

function parseRows(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const dataRows = grid.slice(2); // skip junk row + header
  const stats = {
    total: dataRows.length,
    kept: 0,
    droppedNoAktoerNr: 0,
    droppedNoKontaktpersonFor: 0,
    duplicateAktoerNr: 0,
  };

  const seen = new Set();
  const rows = [];

  for (const r of dataRows) {
    if (!r) continue;
    const aktoerNr = nonEmpty(r[COL.aktoer_nr]);
    if (!aktoerNr) {
      stats.droppedNoAktoerNr++;
      continue;
    }
    if (seen.has(aktoerNr)) {
      stats.duplicateAktoerNr++;
      continue;
    }
    const linkTo = nonEmpty(r[COL.kontaktperson_for]);
    if (!linkTo) {
      stats.droppedNoKontaktpersonFor++;
      continue;
    }
    const { first_name, last_name } = splitName(r[COL.navn]);
    const email = nonEmpty(r[COL.email]);
    const phone = pickPhone(r[COL.telefon], r[COL.mobil]);
    seen.add(aktoerNr);
    rows.push({
      visma_aktoer_nr: aktoerNr,
      link_to_customer_aktoer_nr: linkTo,
      first_name,
      last_name,
      title: nonEmpty(r[COL.titel]),
      email,
      phone,
    });
    stats.kept++;
  }

  return { rows, stats };
}

// ---------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------

const IMPORT_COLUMNS = [
  "visma_aktoer_nr",
  "link_to_customer_aktoer_nr",
  "first_name",
  "last_name",
  "title",
  "email",
  "phone",
];

function sqlLiteral(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildImportSql(rows) {
  const valueRows = rows
    .map(
      (r) =>
        `(${IMPORT_COLUMNS.map((c) => sqlLiteral(r[c])).join(", ")})`,
    )
    .join(",\n  ");

  return `
CREATE TEMP TABLE _lago_contact_import (
  ${IMPORT_COLUMNS.map((c) =>
    c === "visma_aktoer_nr"
      ? `${c} text PRIMARY KEY`
      : `${c} text`,
  ).join(",\n  ")}
) ON COMMIT DROP;

INSERT INTO _lago_contact_import (${IMPORT_COLUMNS.join(", ")}) VALUES
  ${valueRows};

DO $LAGO$
DECLARE
  r RECORD;
  cid bigint;
  cust_id bigint;
  n_new int := 0;
  n_updated int := 0;
  n_skipped_no_customer int := 0;
BEGIN
  FOR r IN SELECT * FROM _lago_contact_import LOOP
    SELECT company_id INTO cust_id
      FROM public.companies_lago
     WHERE visma_aktoer_nr = r.link_to_customer_aktoer_nr;

    IF cust_id IS NULL THEN
      n_skipped_no_customer := n_skipped_no_customer + 1;
      CONTINUE;
    END IF;

    SELECT contact_id INTO cid
      FROM public.contacts_lago
     WHERE visma_aktoer_nr = r.visma_aktoer_nr;

    IF cid IS NULL THEN
      INSERT INTO public.contacts (
        first_name, last_name, title, company_id,
        email_jsonb, phone_jsonb, first_seen, last_seen
      ) VALUES (
        r.first_name, r.last_name, r.title, cust_id,
        CASE WHEN r.email IS NOT NULL
             THEN jsonb_build_array(jsonb_build_object('email', r.email, 'type', 'Work'))
             ELSE NULL END,
        CASE WHEN r.phone IS NOT NULL
             THEN jsonb_build_array(jsonb_build_object('number', r.phone, 'type', 'Work'))
             ELSE NULL END,
        now(),
        now()
      ) RETURNING id INTO cid;

      INSERT INTO public.contacts_lago (
        contact_id, visma_aktoer_nr, last_visma_import_at
      ) VALUES (cid, r.visma_aktoer_nr, now());

      n_new := n_new + 1;
    ELSE
      UPDATE public.contacts SET
        first_name = r.first_name,
        last_name = r.last_name,
        title = r.title,
        company_id = cust_id,
        email_jsonb = CASE WHEN r.email IS NOT NULL
                           THEN jsonb_build_array(jsonb_build_object('email', r.email, 'type', 'Work'))
                           ELSE email_jsonb END,
        phone_jsonb = CASE WHEN r.phone IS NOT NULL
                           THEN jsonb_build_array(jsonb_build_object('number', r.phone, 'type', 'Work'))
                           ELSE phone_jsonb END,
        last_seen = now()
      WHERE id = cid;

      UPDATE public.contacts_lago SET
        last_visma_import_at = now(),
        updated_at = now()
      WHERE contact_id = cid;

      n_updated := n_updated + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'LAGO_CONTACT_IMPORT_DONE new=% updated=% skipped_no_customer=%',
    n_new, n_updated, n_skipped_no_customer;
END
$LAGO$;
`;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Usage: node scripts/lago/import-visma-contacts.mjs <path-to.xlsx> [dry-run] confirm=YES",
    );
    process.exit(1);
  }
  const dryRun = process.argv.includes("dry-run");
  if (!dryRun) requireConfirm();

  console.log(`Parsing ${path} …`);
  const { rows, stats } = parseRows(path);
  console.log("Parse stats:", stats);
  if (rows.length === 0) {
    console.error("No rows survived parsing — refusing to run.");
    process.exit(1);
  }

  // Sanity check: how many link targets exist as imported customers?
  console.log("\nChecking link coverage against imported customers …");
  const linkTargets = [
    ...new Set(rows.map((r) => r.link_to_customer_aktoer_nr).filter(Boolean)),
  ];
  const matches = await runSql(
    `SELECT visma_aktoer_nr FROM public.companies_lago
      WHERE visma_aktoer_nr = ANY(ARRAY[${linkTargets
        .map((v) => `'${v.replace(/'/g, "''")}'`)
        .join(",")}]);`,
  );
  const matchedSet = new Set((matches ?? []).map((m) => m.visma_aktoer_nr));
  const unlinked = rows.filter(
    (r) => !matchedSet.has(r.link_to_customer_aktoer_nr),
  );
  console.log(
    `Distinct link targets: ${linkTargets.length}. Found in kunder: ${matchedSet.size}. Contacts that will be skipped: ${unlinked.length}.`,
  );
  if (unlinked.length > 0 && unlinked.length <= 20) {
    console.log("Skipped (aktoerNr → kontaktperson_for):");
    for (const u of unlinked) {
      console.log(
        `  ${u.visma_aktoer_nr} '${u.first_name ?? ""} ${u.last_name ?? ""}' → kunde ${u.link_to_customer_aktoer_nr}`,
      );
    }
  }

  const sql = buildImportSql(rows);
  if (dryRun) {
    console.log(`\n-- DRY RUN — ${rows.length} rows would be attempted --`);
    console.log(sql.slice(0, 3000));
    console.log(`… (${sql.length} chars total, truncated)`);
    return;
  }

  console.log(
    `\nSending upsert for ${rows.length} contacts to cloud Supabase …`,
  );
  const result = await runSql(sql);
  console.log("Result:", result);

  console.log("\nSanity counts:");
  const counts = await runSql(
    `SELECT
       (SELECT COUNT(*) FROM public.contacts_lago) AS lago_contact_rows,
       (SELECT COUNT(*) FROM public.contacts) AS total_contacts,
       (SELECT COUNT(*) FROM public.contacts_lago
          WHERE last_visma_import_at::date = CURRENT_DATE) AS touched_today,
       (SELECT COUNT(*) FROM public.contacts c
          JOIN public.contacts_lago cl ON cl.contact_id = c.id
          WHERE c.company_id IS NOT NULL) AS linked_to_company;`,
  );
  console.log(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
