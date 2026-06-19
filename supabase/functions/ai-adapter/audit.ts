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
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_estimate_dkk: number | null;
  user_id: string | null;
}

export async function logLlmCall(entry: LlmCallEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("llm_calls").insert(entry);
  if (error) {
    // Audit failures are non-fatal for the caller — but never silent.
    console.error("Failed to write llm_calls row:", error);
  }
}
