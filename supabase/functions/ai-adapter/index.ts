// LAGO ai-adapter — provider-agnostic Edge Function for AI calls.
// Brief A.B: name is "ai-adapter", NOT "claude-adapter", so the model
// behind the adapter can change without renaming the CRM-facing API.
//
// POST /functions/v1/ai-adapter
//   body: { role: string, version: string, input: string }
// Headers (optional):
//   Authorization: Bearer <user JWT>   -> user_id is logged from JWT
//
// Returns: { text, model, provider, prompt_version, usage, cost_estimate_dkk }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logLlmCall } from "./audit.ts";
import { estimateCostDkk } from "./pricing.ts";
import { loadPrompt } from "./promptLoader.ts";
import { createAnthropicProvider } from "./providers/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

interface RequestBody {
  role?: string;
  version?: string;
  input?: string;
  // Brief 21 (AI-3): valgfri kontekst — logges i llm_calls.company_id /
  // sales_id, saa et forslag altid kan spores tilbage til hvem og hvad.
  // Optional fordi hello.v1 smoke-test ikke har en kunde-kontekst; vi
  // afviser ikke kald uden dem.
  company_id?: number;
  sales_id?: number;
}

function extractUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  // Best-effort decode without verification — the JWT was already verified by
  // the gateway upstream (verify_jwt=true in config.toml). We only read sub.
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { role, version, input, company_id, sales_id } = body;
  if (!role || !version || typeof input !== "string") {
    return jsonResponse(
      { error: "Body must include role, version, input (string)" },
      400,
    );
  }
  const companyId = typeof company_id === "number" ? company_id : null;
  const salesId = typeof sales_id === "number" ? sales_id : null;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY not configured on the function" },
      500,
    );
  }

  let prompt;
  try {
    prompt = loadPrompt(role, version);
  } catch (e) {
    return jsonResponse(
      { error: `Failed to load prompt: ${(e as Error).message}` },
      400,
    );
  }

  const provider = createAnthropicProvider(apiKey);
  const userId = extractUserIdFromJwt(req.headers.get("authorization"));
  const promptVersion = `${prompt.meta.role}.${prompt.meta.version}`;

  // Brief 21 § 2: "Registrering maa aldrig vente paa AI." Frontend har
  // en 6s AbortController; edge-siden trykker 5s saa vi kan naa at
  // returnere et pænt outcome="timeout" *foer* klienten selv giver op.
  // Kortere edge-timeout end klient-timeout er bevidst — ellers ved
  // vi kun at klienten gav op, ikke hvorfor.
  const EDGE_TIMEOUT_MS = 5000;
  const start = performance.now();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort("edge-timeout"),
    EDGE_TIMEOUT_MS,
  );

  let aiResponse;
  try {
    aiResponse = await provider.call({
      systemPrompt: prompt.body,
      userInput: input,
      model: prompt.meta.model,
      maxOutputTokens: prompt.meta.max_output_tokens,
      temperature: prompt.meta.temperature,
      signal: timeoutController.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    // Brief 21: log ogsaa fejlede kald — audit-trail er en pligt, ikke
    // en luksus (projektprincip 2). Tokens er ukendte ved fejl → null.
    // Skil timeout fra generel fejl saa vi kan se paa
    // llm_calls-tabellen hvor tid vs. modellen er problemet.
    const latencyOnFail = Math.round(performance.now() - start);
    const isTimeout = timeoutController.signal.aborted;
    await logLlmCall({
      provider: provider.name,
      model: prompt.meta.model,
      prompt_version: promptVersion,
      input_tokens: null,
      output_tokens: null,
      latency_ms: latencyOnFail,
      cost_estimate_dkk: null,
      user_id: userId,
      company_id: companyId,
      sales_id: salesId,
      outcome: isTimeout ? "timeout" : "fejl",
    });
    return jsonResponse(
      {
        error: isTimeout
          ? `AI call exceeded ${EDGE_TIMEOUT_MS} ms — client should show fallback`
          : `AI provider call failed: ${(e as Error).message}`,
      },
      isTimeout ? 504 : 502,
    );
  }
  const latencyMs = Math.round(performance.now() - start);

  const costDkk = estimateCostDkk(
    provider.name,
    prompt.meta.model,
    aiResponse.inputTokens,
    aiResponse.outputTokens,
  );

  const llmCallId = await logLlmCall({
    provider: provider.name,
    model: prompt.meta.model,
    prompt_version: promptVersion,
    input_tokens: aiResponse.inputTokens,
    output_tokens: aiResponse.outputTokens,
    latency_ms: latencyMs,
    cost_estimate_dkk: costDkk,
    user_id: userId,
    company_id: companyId,
    sales_id: salesId,
    outcome: "svar",
  });

  return jsonResponse({
    text: aiResponse.text,
    provider: provider.name,
    model: prompt.meta.model,
    prompt_version: promptVersion,
    // Tillæg 21A: klienten binder tasks til denne id (ai_llm_call_id)
    // og rapporterer added/rejected/ignored-tællinger tilbage via RPC.
    llm_call_id: llmCallId,
    usage: {
      input_tokens: aiResponse.inputTokens,
      output_tokens: aiResponse.outputTokens,
      latency_ms: latencyMs,
    },
    cost_estimate_dkk: costDkk,
  });
});
