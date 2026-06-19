import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  CompanyCore,
  CompanyLagoExtension,
  CompanyNote,
  ContactSummary,
  LagoCustomerData,
  OpenTask,
  SaveExtensionInput,
} from "./types";

// Fetches everything the LAGO customer page needs for one company.
// Each query is small and indexed; PostgREST keeps round-trips down.
// Errors are surfaced — the caller decides what to show.

export async function fetchLagoCustomer(
  companyId: number,
): Promise<LagoCustomerData> {
  const supabase = getSupabaseClient();
  const [companyRes, extensionRes, contactsRes, notesRes] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, sector, size, website, linkedin_url, phone_number, address, zipcode, city, country, tax_identifier, revenue, description, sales_id",
      )
      .eq("id", companyId)
      .single<CompanyCore>(),
    supabase
      .from("companies_lago")
      .select(
        "company_id, visma_customer_no, segment, last_visit_at, next_visit_planned, opening_hours, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .maybeSingle<CompanyLagoExtension>(),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, title, email_jsonb, phone_jsonb")
      .eq("company_id", companyId)
      .order("last_name", { ascending: true })
      .returns<ContactSummary[]>(),
    supabase
      .from("company_notes_lago")
      .select("id, company_id, contact_id, text, sales_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<CompanyNote[]>(),
  ]);

  if (companyRes.error) throw companyRes.error;
  if (extensionRes.error) throw extensionRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (notesRes.error) throw notesRes.error;

  const contactIds = (contactsRes.data ?? []).map((c) => c.id);

  let openTasks: OpenTask[] = [];
  if (contactIds.length > 0) {
    const tasksRes = await supabase
      .from("tasks")
      .select("id, text, due_date, type, contact_id")
      .in("contact_id", contactIds)
      .is("done_date", null)
      .order("due_date", { ascending: true })
      .limit(20)
      .returns<OpenTask[]>();
    if (tasksRes.error) throw tasksRes.error;
    openTasks = tasksRes.data ?? [];
  }

  return {
    company: companyRes.data,
    extension: extensionRes.data ?? null,
    contacts: contactsRes.data ?? [],
    openTasks,
    notes: notesRes.data ?? [],
  };
}

export interface CreateCompanyNoteInput {
  company_id: number;
  text: string;
  contact_id?: number | null;
  sales_id?: number | null;
}

export async function createCompanyNote(
  input: CreateCompanyNoteInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("company_notes_lago").insert({
    company_id: input.company_id,
    contact_id: input.contact_id ?? null,
    text: input.text,
    sales_id: input.sales_id ?? null,
  });
  if (error) throw error;
}

export interface CreateTaskInput {
  contact_id: number;
  text: string;
  due_date: string;
  type?: string | null;
  sales_id?: number | null;
}

export async function createTask(input: CreateTaskInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("tasks").insert({
    contact_id: input.contact_id,
    text: input.text,
    due_date: input.due_date,
    type: input.type ?? null,
    sales_id: input.sales_id ?? null,
  });
  if (error) throw error;
}

export interface CustomerListRow {
  id: number;
  name: string;
  sales_id: number | null;
  city: string | null;
  sector: string | null;
  extension: {
    visma_customer_no: string | null;
    segment: "A" | "B" | "C" | null;
    last_visit_at: string | null;
  } | null;
}

/**
 * Read every company + its LAGO extension in a single embedded query so the
 * sælger-kundeliste can compute priority client-side. Filtering by sales_id
 * happens server-side when "mine kunder" is on.
 */
export async function fetchCustomerList(opts: {
  mySalesId?: number | null;
  onlyMine?: boolean;
}): Promise<CustomerListRow[]> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from("companies")
    .select(
      "id, name, sales_id, city, sector, extension:companies_lago(visma_customer_no, segment, last_visit_at)",
    )
    .order("name", { ascending: true })
    .limit(500);

  if (opts.onlyMine && typeof opts.mySalesId === "number") {
    q = q.eq("sales_id", opts.mySalesId);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const rawExt = Array.isArray(row.extension)
      ? row.extension[0]
      : row.extension;
    return {
      id: row.id as number,
      name: row.name as string,
      sales_id: row.sales_id ?? null,
      city: row.city ?? null,
      sector: row.sector ?? null,
      extension: rawExt
        ? {
            visma_customer_no: rawExt.visma_customer_no ?? null,
            segment: rawExt.segment ?? null,
            last_visit_at: rawExt.last_visit_at ?? null,
          }
        : null,
    };
  });
}

export async function upsertLagoExtension(
  input: SaveExtensionInput,
): Promise<CompanyLagoExtension> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies_lago")
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" },
    )
    .select(
      "company_id, visma_customer_no, segment, last_visit_at, next_visit_planned, opening_hours, created_at, updated_at",
    )
    .single<CompanyLagoExtension>();

  if (error) throw error;
  return data;
}
