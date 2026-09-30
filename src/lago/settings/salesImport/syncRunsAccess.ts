import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 62 (18. sep 2026) · vis sync-noter i Indstillinger.
 *
 * En log der findes, men ikke kan ses, er en log ingen bruger.
 * `sync_runs_lago.note` blev skrevet ordret men aldrig vist —
 * Jonas brugte en time på at efterprøve noget, der stod i noten.
 */

export interface SyncRunRow {
  id: number;
  datasaet: string;
  kilde: string | null;
  raekker: number | null;
  er_testdata: boolean;
  koert_at: string; // ISO
  note: string | null;
}

export async function fetchLatestSyncRuns(limit: number): Promise<SyncRunRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sync_runs_lago")
    .select("id, datasaet, kilde, raekker, er_testdata, koert_at, note")
    .order("koert_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SyncRunRow[];
}
