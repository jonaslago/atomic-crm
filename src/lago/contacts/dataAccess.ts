import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 56 (17. sep 2026) · Kontaktlisten.
 *
 * Ingen synlighed-baseret spærring i RLS (verificeret: alle fire relevante
 * tabeller `USING (true)` for authenticated). Al filtrering sker client-side
 * via WHERE-klausul her. Vi matcher kundelistens filter:
 *   companies_lago.is_visible_to_sales = true
 *   companies_lago.is_active           = true
 *
 * Kontakten arver kundens synlighed — men "kundens synlighed" er ikke
 * "kundens ejer". Alle sælgere ser alle sælger-synlige kontakter; "Ansvarlig
 * sælger"-rullelisten er et valg, ikke en spærre.
 */

export interface ContactListRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email_jsonb: Array<{ email: string; type?: string }> | null;
  phone_jsonb: Array<{ number: string; type?: string }> | null;
  company_id: number;
  is_webshop_user: boolean | null;
  company: {
    id: number;
    name: string;
    city: string | null;
    sales_id: number | null;
  };
  extension: {
    segment: "A" | "B" | "C" | "X" | "L" | null;
    distrikt: string | null;
    branche_kode: number | null;
    visma_sales_code: string | null;
    visma_sales_name: string | null;
  };
}

const MAX_ROWS = 5000;

/**
 * Fetches every contact whose company is sælger-synlig og aktiv. Filter
 * på is_visible_to_sales/is_active gøres client-side FØR mapping — nested
 * PostgREST-filter er upålideligt på tværs af flere embed-niveauer, så vi
 * beder om det inner-joinede felt og trimmer selv.
 */
export async function fetchContactList(): Promise<ContactListRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `id, first_name, last_name, title, email_jsonb, phone_jsonb, company_id,
       contact_ext:contacts_lago(is_webshop_user),
       company:companies!inner(
         id, name, city, sales_id,
         company_ext:companies_lago!inner(
           segment, distrikt, branche_kode, visma_sales_code, visma_sales_name,
           is_visible_to_sales, is_active
         )
       )`,
    )
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .range(0, MAX_ROWS - 1);

  if (error) throw error;

  const rows: ContactListRow[] = [];
  for (const raw of (data ?? []) as any[]) {
    const contactExt = Array.isArray(raw.contact_ext)
      ? raw.contact_ext[0]
      : raw.contact_ext;
    const company = Array.isArray(raw.company) ? raw.company[0] : raw.company;
    if (!company) continue;
    const companyExt = Array.isArray(company.company_ext)
      ? company.company_ext[0]
      : company.company_ext;
    if (!companyExt) continue;
    if (companyExt.is_visible_to_sales !== true) continue;
    if (companyExt.is_active !== true) continue;

    rows.push({
      id: raw.id,
      first_name: raw.first_name ?? null,
      last_name: raw.last_name ?? null,
      title: raw.title ?? null,
      email_jsonb: raw.email_jsonb ?? null,
      phone_jsonb: raw.phone_jsonb ?? null,
      company_id: raw.company_id,
      is_webshop_user: contactExt?.is_webshop_user ?? null,
      company: {
        id: company.id,
        name: company.name,
        city: company.city ?? null,
        sales_id: company.sales_id ?? null,
      },
      extension: {
        segment: companyExt.segment ?? null,
        distrikt: companyExt.distrikt ?? null,
        branche_kode: companyExt.branche_kode ?? null,
        visma_sales_code: companyExt.visma_sales_code ?? null,
        visma_sales_name: companyExt.visma_sales_name ?? null,
      },
    });
  }
  return rows;
}

/**
 * Formaterer et navn til visning. `null`-håndtering per brief 56 §6:
 * mangler efternavn, vises fornavn alene. "Charlotte null" må aldrig
 * nå skærmen. Mangler også fornavn returneres tom streng — kalder-siden
 * afgør hvordan det håndteres (typisk vises kontakten ikke).
 */
export function formatContactName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f && l) return `${f} ${l}`;
  return f || l;
}

/**
 * Trækker første e-mail ud af email_jsonb. Kontakter kan have flere; vi
 * viser den første i listen (typisk arbejds-mail fra VISMA-importen).
 */
export function primaryEmail(
  emails: ContactListRow["email_jsonb"],
): string | null {
  if (!emails || emails.length === 0) return null;
  const work = emails.find((e) => e.type === "Work");
  return (work ?? emails[0]).email || null;
}

/**
 * Trækker det bedste telefonnummer ud af phone_jsonb. Prioritet:
 * arbejde → mobil → første. VISMA sender ofte kun ét, så prioriteringen
 * bider mest ved kontakter oprettet i CRM.
 */
export function primaryPhone(
  phones: ContactListRow["phone_jsonb"],
): string | null {
  if (!phones || phones.length === 0) return null;
  const work = phones.find((p) => p.type === "Work");
  if (work?.number) return work.number;
  const mobile = phones.find((p) => p.type === "Mobile");
  if (mobile?.number) return mobile.number;
  return phones[0].number || null;
}
