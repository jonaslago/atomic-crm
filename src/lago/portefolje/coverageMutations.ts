import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 84 tillæg A §2 (28. sep 2026) · coverage_log_lago-skrivninger.
 *
 * Simpelt UI-styret log. Ingen Edge Function, ingen session-swap
 * (det er briefens hele pointe: Simon er Simon). RLS på tabellen
 * sikrer at covering_user_id skal matche auth.uid() ved INSERT, og
 * at kun egen åbne række kan lukkes ved UPDATE.
 *
 * Rapporteres non-fatalt: en tabt log må ikke blokere dækningen
 * (samme princip som task_events_lago's udskyd-flow).
 */

export interface StartCoverageInput {
  coveringUserId: string;
  coveringSalesId: number | null;
  coveredUserId: string;
  coveredSalesId: number;
}

export async function startCoverageLog(
  input: StartCoverageInput,
): Promise<number | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("coverage_log_lago")
    .insert({
      covering_user_id: input.coveringUserId,
      covering_sales_id: input.coveringSalesId,
      covered_user_id: input.coveredUserId,
      covered_sales_id: input.coveredSalesId,
    })
    .select("id")
    .single<{ id: number }>();
  if (error) {
    console.error("Kunne ikke logge dæknings-start:", error);
    return null;
  }
  return data.id;
}

export async function endCoverageLog(
  logId: number,
  reason: "manual" | "session_end" = "manual",
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("coverage_log_lago")
    .update({ ended_at: new Date().toISOString(), ended_reason: reason })
    .eq("id", logId)
    .is("ended_at", null);
  if (error) {
    console.error("Kunne ikke lukke dæknings-log:", error);
  }
}
