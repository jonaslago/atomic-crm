import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export interface LlmCallEntry {
  provider: string;
  model: string;
  prompt_version: string;
  // Brief 21: også fejlede kald skal logges — tokens er derfor nullable.
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
  cost_estimate_dkk: number | null;
  user_id: string | null;
  // Brief 21 (AI-3): kontekst fra kalder + udfald.
  company_id: number | null;
  sales_id: number | null;
  outcome: "svar" | "timeout" | "fejl" | "ugyldigt_svar";
}

export async function logLlmCall(entry: LlmCallEntry): Promise<number | null> {
  // Tillæg 21A: klienten skal kunne referere denne række fra tasks
  // (ai_llm_call_id) og opdatere count_added/rejected/ignored via
  // record_ai_suggestion_outcomes-RPC. Uden id kan udfaldet ikke måles.
  const { data, error } = await supabaseAdmin
    .from("llm_calls")
    .insert(entry)
    .select("id")
    .single<{ id: number }>();
  if (error) {
    // Audit failures are non-fatal for the caller — but never silent.
    console.error("Failed to write llm_calls row:", error);
    return null;
  }
  return data.id;
}
