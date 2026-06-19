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
  segment?: "A" | "B" | "C" | null;
  last_visit_at?: string | null;
  next_visit_planned?: string | null;
  opening_hours?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSummary {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email_jsonb?: Array<{ email: string; type?: string }> | null;
  phone_jsonb?: Array<{ number: string; type?: string }> | null;
}

export interface OpenTask {
  id: number;
  text: string;
  due_date?: string | null;
  type?: string | null;
  contact_id: number;
}

export interface CompanyNote {
  id: number;
  company_id: number;
  contact_id?: number | null;
  text: string;
  sales_id?: number | null;
  created_at: string;
}

export interface LagoCustomerData {
  company: CompanyCore;
  extension: CompanyLagoExtension | null;
  contacts: ContactSummary[];
  openTasks: OpenTask[];
  notes: CompanyNote[];
}

export interface SaveExtensionInput {
  company_id: number;
  visma_customer_no?: string | null;
  segment?: "A" | "B" | "C" | null;
  last_visit_at?: string | null;
  next_visit_planned?: string | null;
  opening_hours?: string | null;
}
