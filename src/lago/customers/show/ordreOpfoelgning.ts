import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * §99 (2. okt 2026): office follow-up actions on open orders.
 *
 * Three actions, three database writes:
 *   1. Send to salesperson — creates a task + opfoelgning record
 *   2. Mark as changed in VISMA — opfoelgning with 24h deadline
 *   3. Postpone — opfoelgning with chosen deadline
 */

export interface OrdreOpfoelgning {
  id: number;
  ordreNr: string;
  companyId: number;
  handling: "sendt_til_saelger" | "afventer_visma" | "udskudt";
  oprettetAf: number | null;
  oprettet: string;
  frist: string | null;
  sendtTil: number | null;
  taskId: number | null;
  status: "aktiv" | "bekraeftet" | "udloebet" | "annulleret";
  note: string | null;
}

/** Fetch active follow-ups for a set of orders */
export async function fetchOrdreOpfoelgninger(
  ordreNumre: string[],
): Promise<Map<string, OrdreOpfoelgning>> {
  if (ordreNumre.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ordre_opfoelgning_lago")
    .select(
      "id, ordre_nr, company_id, handling, oprettet_af, oprettet, frist, sendt_til, task_id, status, note",
    )
    .in("ordre_nr", ordreNumre)
    .eq("status", "aktiv")
    .order("oprettet", { ascending: false });
  if (error) throw error;

  // One active follow-up per order (most recent)
  const map = new Map<string, OrdreOpfoelgning>();
  for (const r of (data ?? []) as Array<{
    id: number;
    ordre_nr: string;
    company_id: number;
    handling: OrdreOpfoelgning["handling"];
    oprettet_af: number | null;
    oprettet: string;
    frist: string | null;
    sendt_til: number | null;
    task_id: number | null;
    status: OrdreOpfoelgning["status"];
    note: string | null;
  }>) {
    if (!map.has(r.ordre_nr)) {
      map.set(r.ordre_nr, {
        id: r.id,
        ordreNr: r.ordre_nr,
        companyId: r.company_id,
        handling: r.handling,
        oprettetAf: r.oprettet_af,
        oprettet: r.oprettet,
        frist: r.frist,
        sendtTil: r.sendt_til,
        taskId: r.task_id,
        status: r.status,
        note: r.note,
      });
    }
  }
  return map;
}

/** Send order to salesperson for follow-up */
export async function sendTilSaelger(input: {
  ordreNr: string;
  companyId: number;
  oprettetAf: number;
  sendtTil: number;
  frist: string;
  note: string | null;
  /** Contact ID for the task */
  contactId: number;
  /** Task text */
  taskText: string;
}): Promise<void> {
  const supabase = getSupabaseClient();

  // Create task for the salesperson
  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .insert({
      text: input.taskText,
      type: "follow-up",
      due_date: new Date(input.frist + "T12:00:00").toISOString(),
      sales_id: input.sendtTil,
      contact_id: input.contactId,
    })
    .select("id")
    .single<{ id: number }>();
  if (taskError) throw taskError;

  // Create follow-up record
  const { error } = await supabase.from("ordre_opfoelgning_lago").insert({
    ordre_nr: input.ordreNr,
    company_id: input.companyId,
    handling: "sendt_til_saelger",
    oprettet_af: input.oprettetAf,
    frist: input.frist,
    sendt_til: input.sendtTil,
    task_id: taskData.id,
    note: input.note,
  });
  if (error) throw error;
}

/** Mark order as "status changed in VISMA" — 24h deadline */
export async function markerAfventerVisma(input: {
  ordreNr: string;
  companyId: number;
  oprettetAf: number;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const frist = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const { error } = await supabase.from("ordre_opfoelgning_lago").insert({
    ordre_nr: input.ordreNr,
    company_id: input.companyId,
    handling: "afventer_visma",
    oprettet_af: input.oprettetAf,
    frist,
  });
  if (error) throw error;
}

/** Postpone follow-up with a chosen deadline */
export async function udskydOpfoelgning(input: {
  ordreNr: string;
  companyId: number;
  oprettetAf: number;
  frist: string;
  note: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("ordre_opfoelgning_lago").insert({
    ordre_nr: input.ordreNr,
    company_id: input.companyId,
    handling: "udskudt",
    oprettet_af: input.oprettetAf,
    frist: input.frist,
    note: input.note,
  });
  if (error) throw error;
}
