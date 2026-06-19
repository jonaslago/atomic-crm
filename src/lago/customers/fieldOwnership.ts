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
  { key: "sector", owner: "visma", readOnly: false },
  { key: "size", owner: "visma", readOnly: false },
  { key: "revenue", owner: "visma", readOnly: false },
  { key: "website", owner: "crm", readOnly: false },
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
  { key: "visma_customer_no", owner: "visma", readOnly: false },
  { key: "segment", owner: "crm", readOnly: false },
  { key: "last_visit_at", owner: "crm", readOnly: false },
  { key: "next_visit_planned", owner: "crm", readOnly: false },
  { key: "opening_hours", owner: "crm", readOnly: false },
] as const;

const BY_KEY = new Map<string, OwnedField>(
  [...COMPANY_CORE_FIELDS, ...COMPANY_LAGO_FIELDS].map((f) => [f.key, f]),
);

export function ownershipOf(fieldKey: string): OwnedField | undefined {
  return BY_KEY.get(fieldKey);
}
