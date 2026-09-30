/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Nielsen & Vin · phone_number råt ===");
  const nielsen = await runSql(`
    SELECT id, name, phone_number
    FROM public.companies
    WHERE name ILIKE '%Nielsen%Vin%'
  `);
  console.log(JSON.stringify(nielsen, null, 2));

  console.log("\n=== Længdefordeling for phone_number (kun cifre) ===");
  const fordeling = await runSql(`
    WITH renset AS (
      SELECT id, name, phone_number,
             regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') AS cifre
      FROM public.companies
    )
    SELECT
      length(cifre) AS antal_cifre,
      COUNT(*) AS antal_kunder
    FROM renset
    GROUP BY antal_cifre
    ORDER BY antal_cifre
  `);
  console.log(JSON.stringify(fordeling, null, 2));

  console.log("\n=== Sammenfatning ===");
  const summary = await runSql(`
    WITH renset AS (
      SELECT c.id,
             regexp_replace(COALESCE(c.phone_number, ''), '[^0-9]', '', 'g') AS cifre,
             cl.is_active, cl.is_visible_to_sales
      FROM public.companies c
      LEFT JOIN public.companies_lago cl ON cl.company_id = c.id
    )
    SELECT
      COUNT(*) AS kunder_i_alt,
      COUNT(*) FILTER (WHERE cifre = '') AS uden_nummer,
      COUNT(*) FILTER (WHERE length(cifre) > 0 AND length(cifre) < 8) AS for_kort,
      COUNT(*) FILTER (WHERE length(cifre) = 8) AS otte_cifre,
      COUNT(*) FILTER (WHERE length(cifre) > 8) AS for_langt,
      COUNT(*) FILTER (WHERE cifre <> '' AND length(cifre) <> 8) AS ikke_otte,
      COUNT(*) FILTER (WHERE cifre <> '' AND length(cifre) <> 8 AND is_active = true AND is_visible_to_sales = true) AS ikke_otte_synlige_aktive
    FROM renset
  `);
  console.log(JSON.stringify(summary, null, 2));

  console.log("\n=== Eksempler på ikke-otte-cifre-numre (top 10) ===");
  const eksempler = await runSql(`
    WITH renset AS (
      SELECT c.id, c.name, c.phone_number,
             regexp_replace(COALESCE(c.phone_number, ''), '[^0-9]', '', 'g') AS cifre
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      WHERE cl.is_active = true AND cl.is_visible_to_sales = true
    )
    SELECT name, phone_number, cifre, length(cifre) AS antal_cifre
    FROM renset
    WHERE cifre <> '' AND length(cifre) <> 8
    ORDER BY length(cifre), name
    LIMIT 10
  `);
  console.log(JSON.stringify(eksempler, null, 2));

  console.log("\n=== Kontakter (contacts.phone_jsonb) — samme længde-tjek ===");
  const kontakter = await runSql(`
    WITH tel AS (
      SELECT ct.id,
             ct.first_name || ' ' || COALESCE(ct.last_name, '') AS navn,
             (phone->>'number') AS raw,
             regexp_replace(COALESCE(phone->>'number', ''), '[^0-9]', '', 'g') AS cifre
      FROM public.contacts ct
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(ct.phone_jsonb, '[]'::jsonb)) AS phone ON true
    )
    SELECT
      COUNT(*) FILTER (WHERE raw IS NOT NULL) AS numre_i_alt,
      COUNT(*) FILTER (WHERE cifre <> '' AND length(cifre) <> 8) AS ikke_otte_cifre
    FROM tel
  `);
  console.log(JSON.stringify(kontakter, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
