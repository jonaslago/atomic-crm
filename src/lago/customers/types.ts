// Types for the LAGO customer page. Mirrors the shape of upstream's
// `public.companies` + LAGO's `public.companies_lago` + the related lists
// the page renders (contacts, tasks, recent notes).

export interface CompanyCore {
  id: number;
  name: string;
  sector?: string | null;
  size?: number | null;
  website?: string | null;
  linkedin_url?: string | null;
  phone_number?: string | null;
  address?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  tax_identifier?: string | null;
  revenue?: string | null;
  description?: string | null;
  sales_id?: number | null;
}

export interface CompanyLagoExtension {
  company_id: number;
  visma_customer_no?: string | null;
  /** Brief 13: A/B/C/X/L. Default X. */
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  last_visit_at?: string | null;
  next_visit_planned?: string | null;
  /** Brief 15: valgfri "hvad vil jeg"-note på den planlagte booking. */
  next_visit_note?: string | null;
  opening_hours?: string | null;
  faktura_email?: string | null;
  /** Brief 39 (16. sep 2026): fri tekst fra VISMA Kundeudtrækket. */
  debitorinfo?: string | null;
  distrikt?: string | null;
  betaling?: string | null;
  visma_sales_code?: string | null;
  visma_sales_name?: string | null;
  /** Brief 13: droppet — kolonnen kan stadig findes i legacy data,
   *  men skrives ikke længere til og vises ikke i UI. */
  kundestatus?: string | null;
  /** Brief 13: VISMAs Statuskode (1/0). */
  visma_statuskode?: number | null;
  /** Brief 13: default kun aktive vises i lister. */
  is_active?: boolean | null;
  last_visma_import_at?: string | null;
  /** Brief 65 (18. sep 2026): override af besøgsfrekvens. NULL = brug
   *  segmentets standard (30/60/75 for A/B/C, ingen for X/L). 7-365. */
  besoegsfrekvens_dage?: number | null;
  /** Brief 65: "hvorfor". Vises på kundekortet og i ringelisten. */
  besoegsfrekvens_note?: string | null;
  /** Brief 65: hvem valgte frekvensen. Null hvis brugeren senere er slettet. */
  besoegsfrekvens_sat_af?: number | null;
  /** Brief 65: hvornår frekvensen blev valgt. */
  besoegsfrekvens_sat?: string | null;
  /** Brief 68 (21. sep 2026): VISMA-eksporteret kreditspærre. Vises som
   *  rød "Kreditspærret"-chip i kundekortets header, i preview-panelet
   *  og i kortets ark. `true` = spærret, `false` = ikke spærret,
   *  `null` = ukendt (historisk hul; behandles som ikke spærret i UI). */
  kreditspaerre?: boolean | null;
  /** Brief 90 §3 (28. sep 2026): sæsonlukket-periode. Er CURRENT_DATE
   *  mellem fra og til (inkl.) får kunden status='saesonlukket' i
   *  customers_with_priority_lago; ringelisten og "Kunder der skal
   *  besøges" udelukker hende automatisk. Uret nulstilles ikke —
   *  last_visit_at røres ikke, og hun får sin gamle days_overdue
   *  tilbage samme sekund vinduet slutter. */
  saesonlukket_fra?: string | null;
  saesonlukket_til?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSummary {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  status?: string | null;
  email_jsonb?: Array<{ email: string; type?: string }> | null;
  phone_jsonb?: Array<{ number: string; type?: string }> | null;
  // Brief 29 §2: sæt fra contacts_lago.is_webshop_user. Kontakten skal
  // bære et mærkat om at webshop-adgangen styres i VISMA — ikke i CRM'et.
  // Uden mærkatet gør nogen den fejl at rette kontakten og tror at
  // webshop-loginet dermed er lukket. Det er det ikke.
  is_webshop_user?: boolean | null;
}

export interface OpenTask {
  id: number;
  text: string;
  due_date?: string | null;
  type?: string | null;
  contact_id: number;
  /** Brief 48 §C (16. sep 2026): opfølgningsrækker på kundekortet
   *  viser "Ansvarlig: X". Navnet resolves via useSellerLookup i UI. */
  sales_id?: number | null;
}

export interface CompanyNote {
  id: number;
  company_id: number;
  contact_id?: number | null;
  text: string;
  sales_id?: number | null;
  created_at: string;
}

export interface CustomerActivity {
  id: number;
  company_id: number;
  activity_date: string;
  activity_type_code: number | null;
  activity_type: string | null;
  description: string | null;
  sales_name: string | null;
  // Brief 16. sep 2026: nødvendig for slet-eligibility.
  // Kun source='crm_native' + (sales_id = current OR admin) må slette.
  sales_id: number | null;
  done: boolean;
  source: string;
}

export interface LagoCustomerData {
  company: CompanyCore;
  extension: CompanyLagoExtension | null;
  contacts: ContactSummary[];
  openTasks: OpenTask[];
  notes: CompanyNote[];
  activities: CustomerActivity[];
  /** Brief 64 fase 2 (18. sep 2026): serverberegnet grundstatus fra
   *  public.customers_with_priority_lago. NULL når view'et ikke har en
   *  række for kunden (fx før companies_lago-rækken eksisterer). */
  visitPriority: {
    status:
      | "overdue"
      | "soon"
      | "on_plan"
      | "never_visited"
      | "no_urgency";
    days_overdue: number | null;
    interval_days: number;
    days_since_visit: number | null;
  } | null;
}

export interface SaveExtensionInput {
  company_id: number;
  visma_customer_no?: string | null;
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  last_visit_at?: string | null;
  next_visit_planned?: string | null;
  next_visit_note?: string | null;
  opening_hours?: string | null;
}
