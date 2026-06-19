import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  CompanyCore,
  CompanyLagoExtension,
  ContactSummary,
  LagoCustomerData,
  OpenTask,
  RecentNote,
  SaveExtensionInput,
} from "./types";

// Fetches everything the LAGO customer page needs for one company.
// Each query is small and indexed; PostgREST keeps round-trips down.
// Errors are surfaced — the caller decides what to show.

export async function fetchLagoCustomer(
  companyId: number,
): Promise<LagoCustomerData> {
  const supabase = getSupabaseClient();
  const [companyRes, extensionRes, contactsRes] = await Promise.all([
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
  ]);

  if (companyRes.error) throw companyRes.error;
  if (extensionRes.error) throw extensionRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const contactIds = (contactsRes.data ?? []).map((c) => c.id);

  let openTasks: OpenTask[] = [];
  let recentNotes: RecentNote[] = [];

  if (contactIds.length > 0) {
    const [tasksRes, notesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, text, due_date, type, contact_id")
        .in("contact_id", contactIds)
        .is("done_date", null)
        .order("due_date", { ascending: true })
        .limit(20)
        .returns<OpenTask[]>(),
      supabase
        .from("contact_notes")
        .select("id, text, date, contact_id, sales_id")
        .in("contact_id", contactIds)
        .order("date", { ascending: false })
        .limit(10)
        .returns<RecentNote[]>(),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (notesRes.error) throw notesRes.error;
    openTasks = tasksRes.data ?? [];
    recentNotes = notesRes.data ?? [];
  }

  return {
    company: companyRes.data,
    extension: extensionRes.data ?? null,
    contacts: contactsRes.data ?? [],
    openTasks,
    recentNotes,
  };
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
