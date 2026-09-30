// LAGO master-data ownership manifest (jf. Domain-brief 1 + VISMA-notat §7c).
//
// Every column on `public.companies` is classified as either VISMA-owned
// (master data — becomes read-only once the VISMA sync goes live) or
// CRM-owned (always editable in CRM). The extra columns on
// `public.companies_lago` are all CRM-owned by definition; the
// `visma_customer_no` is the join key — VISMA-owned but editable manually
// until sync is live.
//
// The UI consults this manifest to decide whether a field gets a small
// "Synkes fra VISMA"-badge and (later) a disabled state.

export type FieldOwner = "visma" | "crm";

export interface OwnedField {
  /** Column name in the underlying table. */
  readonly key: string;
  /** Which side owns the truth for this field. */
  readonly owner: FieldOwner;
  /**
   * `true` once the column is no longer hand-editable in CRM (i.e. VISMA
   * sync is live). For Phase 1 every field is still editable.
   */
  readonly readOnly: boolean;
}

/**
 * Columns on `public.companies` (upstream Atomic CRM table).
 * Ownership matches the Domain-brief: master-data fields are VISMA's; the
 * relationship/enrichment fields stay CRM's.
 */
export const COMPANY_CORE_FIELDS: readonly OwnedField[] = [
  { key: "name", owner: "visma", readOnly: false },
  { key: "phone_number", owner: "visma", readOnly: false },
  { key: "address", owner: "visma", readOnly: false },
  { key: "zipcode", owner: "visma", readOnly: false },
  { key: "city", owner: "visma", readOnly: false },
  { key: "country", owner: "visma", readOnly: false },
  { key: "tax_identifier", owner: "visma", readOnly: false },
  // sector = Branche in VISMA; brief 5 makes it CRM-owned (seeded on
  // first import, never overwritten by re-imports).
  { key: "sector", owner: "crm", readOnly: false },
  { key: "size", owner: "visma", readOnly: false },
  { key: "revenue", owner: "visma", readOnly: false },
  { key: "website", owner: "visma", readOnly: false },
  { key: "linkedin_url", owner: "crm", readOnly: false },
  { key: "description", owner: "crm", readOnly: false },
  { key: "context_links", owner: "crm", readOnly: false },
  { key: "sales_id", owner: "crm", readOnly: false },
  { key: "logo", owner: "crm", readOnly: false },
] as const;

/**
 * Columns on the LAGO side-car `public.companies_lago`.
 * `visma_customer_no` is the join key with VISMA (VISMA-owned conceptually,
 * but editable in CRM until sync overwrites it).
 */
export const COMPANY_LAGO_FIELDS: readonly OwnedField[] = [
  // Brief 37 §6 (16. sep 2026): VISMA-kundenr redigeres ikke længere
  // manuelt. Det er join-nøglen og skal komme fra VISMA — hvis nogen
  // retter et ciffer her, taber vi sammenhængen til fakturadata uden at
  // opdage det. Read-only, med den grå VISMA-badge i UI.
  { key: "visma_customer_no", owner: "visma", readOnly: true },
  { key: "segment", owner: "crm", readOnly: false },
  { key: "last_visit_at", owner: "crm", readOnly: false },
  { key: "next_visit_planned", owner: "crm", readOnly: false },
  { key: "opening_hours", owner: "crm", readOnly: false },
  // Additional VISMA-mirrored operational fields (brief 5). NB: this
  // is VISMA's invoicing address — the contact e-mail lives on the
  // contact records.
  { key: "faktura_email", owner: "visma", readOnly: false },
  { key: "distrikt", owner: "visma", readOnly: false },
  { key: "betaling", owner: "visma", readOnly: false },
  { key: "visma_sales_code", owner: "visma", readOnly: false },
  { key: "visma_sales_name", owner: "visma", readOnly: false },
  // Kundestatus is CRM-owned (Aktiv/Lead/Uafklaret/… lives in CRM after
  // first-import seed).
  { key: "kundestatus", owner: "crm", readOnly: false },
  // Kundetype (brief 19): styrer prisliste i VISMA. Følger kunden.
  // VISMA-ejet — kommer med kundeimporten, rettes ikke i CRM. Må ikke
  // blandes sammen med segment (kundetype = hvad kunden ER, segment =
  // hvor meget vi investerer i den).
  { key: "kundetype", owner: "visma", readOnly: false },
  // Brief 39 §1 (16. sep 2026, rev. 21. sep): Debitorinfo er
  // bogholderiets felt i VISMA. VISMA er master, feltet er readOnly i
  // CRM — en rettelse ville alligevel blive overskrevet næste nat, og
  // det er bogholderiet der bestemmer om lampen skal slukke.
  { key: "debitorinfo", owner: "visma", readOnly: true },
] as const;

/**
 * Columns on `public.contacts` (upstream Atomic CRM table).
 * VISMA supplies contact identity (name, title, phone, e-mail) through
 * its `Contacts/{customerNo}` endpoint — those stay VISMA-owned. The
 * relationship-flavoured fields (status, tags, background, gender,
 * newsletter, LinkedIn, sales_id) remain CRM-owned and freely editable.
 * `readOnly` stays false until the NOTO/VISMA sync is live.
 */
export const CONTACT_FIELDS: readonly OwnedField[] = [
  { key: "first_name", owner: "visma", readOnly: false },
  { key: "last_name", owner: "visma", readOnly: false },
  { key: "title", owner: "visma", readOnly: false },
  { key: "phone_jsonb", owner: "visma", readOnly: false },
  { key: "email_jsonb", owner: "visma", readOnly: false },
  { key: "company_id", owner: "visma", readOnly: false },
  { key: "status", owner: "crm", readOnly: false },
  { key: "tags", owner: "crm", readOnly: false },
  { key: "background", owner: "crm", readOnly: false },
  { key: "gender", owner: "crm", readOnly: false },
  { key: "has_newsletter", owner: "crm", readOnly: false },
  { key: "linkedin_url", owner: "crm", readOnly: false },
  { key: "sales_id", owner: "crm", readOnly: false },
] as const;

const BY_KEY = new Map<string, OwnedField>(
  [...COMPANY_CORE_FIELDS, ...COMPANY_LAGO_FIELDS, ...CONTACT_FIELDS].map(
    (f) => [f.key, f],
  ),
);

export function ownershipOf(fieldKey: string): OwnedField | undefined {
  return BY_KEY.get(fieldKey);
}
