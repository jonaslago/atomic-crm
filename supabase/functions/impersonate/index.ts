// Domain-brief 27 · "Log ind som" (PO-11) — Edge Function.
// Tillæg A (16. sep 2026): sessionen udstedes af Supabase, ikke af os.
//
// POST /functions/v1/impersonate
//   body: { target_user_id: string }  // target's auth.users.id
// Headers:
//   Authorization: Bearer <admin JWT>  // required; admin identity
//
// Returns: {
//   token_hash: string,   // fra admin.generateLink — klienten kalder
//                         //   verifyOtp({ token_hash, type: 'email' })
//                         //   for at få en Supabase-udstedt session
//   log_id: number,
//   expires_at: string,   // ISO — log-baseret 30 min-vindue
//   target: { user_id, sales_id, full_name, email },
// }
//
// HVORFOR IKKE SIGNERE JWT SELV:
//
// GOAL CRM signerer med ECC (P-256); Supabase udleverer ikke den
// private nøgle. Den gamle HS256 "PREVIOUS KEY" ville virke lige
// indtil nogen trykker "revoke" i dashboardet — så holdt "Log ind
// som" op med at virke uden nogen forklaring. Fravalgt (tillæg A §1).
//
// KONSEKVENS AF DEN NYE MODEL:
//
// En Supabase-udstedt session kan ikke bære custom claims. Skrive-
// spærringen kan derfor ikke længere hvile på en JWT-claim; den er
// flyttet til databasen (migration 20260918100000). Guard-triggeren
// spørger, om der findes en åben impersonation_log_lago-række for
// auth.uid() inden for 30 min.
//
// Spærringen gælder BRUGEREN, ikke sessionen: mens Jonas ser
// systemet som Camilla, kan den rigtige Camilla heller ikke skrive.
// I praksis er hun ikke logget ind, sessionen varer 30 min, og det
// retter sig selv (tillæg A §3). Det skal stå her, så ingen bruger
// tid på at undre sig.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

const SESSION_TTL_MINUTES = 30; // brief §1 pkt 4

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function extractUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
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

  const adminUserId = extractUserIdFromJwt(req.headers.get("authorization"));
  if (!adminUserId) {
    return jsonResponse(
      { error: "Missing or invalid Authorization header" },
      401,
    );
  }

  let body: { target_user_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const targetUserId = body.target_user_id;
  if (!targetUserId || typeof targetUserId !== "string") {
    return jsonResponse(
      { error: "Body must include target_user_id (string)" },
      400,
    );
  }

  // Brief §5: kan ikke være sig selv.
  if (targetUserId === adminUserId) {
    return jsonResponse(
      { error: "Kan ikke logge ind som sig selv" },
      400,
    );
  }

  // Brief §1 pkt 1: kalderens admin-status verificeres server-side —
  // ikke fra et felt i request-bodyen.
  //
  // Chaining-forbud: en imperson-session bruger targets JWT, som
  // hører til en non-admin bruger. Admin-checken afviser hende
  // automatisk — vi behøver ikke en separat claim-check.
  const adminRes = await supabaseAdmin
    .from("sales")
    .select("id, administrator")
    .eq("user_id", adminUserId)
    .maybeSingle<{ id: number; administrator: boolean | null }>();
  if (adminRes.error || !adminRes.data) {
    return jsonResponse(
      { error: "Kalderens sales-profil kunne ikke slås op" },
      403,
    );
  }
  if (!adminRes.data.administrator) {
    return jsonResponse(
      { error: "Kun admin-brugere kan logge ind som en anden" },
      403,
    );
  }
  const adminSalesId = adminRes.data.id;

  // Verificér target findes.
  const targetRes = await supabaseAdmin
    .from("sales")
    .select("id, first_name, last_name, administrator, email")
    .eq("user_id", targetUserId)
    .maybeSingle<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      administrator: boolean | null;
      email: string | null;
    }>();
  if (targetRes.error || !targetRes.data) {
    return jsonResponse(
      { error: "Målbrugeren kunne ikke slås op" },
      404,
    );
  }
  // Brief 27-tillæg (16. sep 2026): forbyd impersonation af admin.
  // Man lærer alligevel ikke noget som en anden admin, man ikke kan
  // se som sig selv — og det fjerner en hel klasse af risiko.
  if (targetRes.data.administrator) {
    return jsonResponse(
      {
        error:
          "Kan ikke logge ind som en anden admin. 'Log ind som' er kun til brugere med begrænset rettigheder.",
      },
      403,
    );
  }
  const targetSalesId = targetRes.data.id;
  const targetFullName = [
    targetRes.data.first_name,
    targetRes.data.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || null;

  // sales.email er NOT NULL i schemaet og holdes synkroniseret med
  // auth.users.email via upstream-triggeren — vi behøver ikke et
  // ekstra admin.getUserById-kald for at få mail-adressen.
  const targetSalesRow = await supabaseAdmin
    .from("sales")
    .select("email")
    .eq("id", targetSalesId)
    .single<{ email: string | null }>();
  if (targetSalesRow.error || !targetSalesRow.data?.email) {
    return jsonResponse(
      {
        error:
          "Målbrugeren har ingen email — magic-link kan ikke udstedes",
      },
      409,
    );
  }
  const targetEmail = targetSalesRow.data.email;

  // Brief §4: skriv revisionsrækken FØR sessionen udleveres.
  // ended_at + ended_reason er NULL — guard-triggeren betragter den
  // som "åben" i 30 min, hvorefter tidsvinduet alene lukker den.
  const logInsert = await supabaseAdmin
    .from("impersonation_log_lago")
    .insert({
      admin_user_id: adminUserId,
      admin_sales_id: adminSalesId,
      target_user_id: targetUserId,
      target_sales_id: targetSalesId,
    })
    .select("id, started_at")
    .single<{ id: number; started_at: string }>();
  if (logInsert.error) {
    return jsonResponse(
      { error: `Kunne ikke skrive revisionsrække: ${logInsert.error.message}` },
      500,
    );
  }

  // Tillæg A §1: lad Supabase udstede sessionen.
  //
  // admin.generateLink({type:'magiclink'}) returnerer et hashed_token
  // uden at sende mail. Klienten verifierer det med verifyOtp og får
  // en ægte session, signeret med den aktuelle nøgle. Roterer
  // projektet nøgle, følger tokens automatisk med — ingen hemmelighed
  // at vedligeholde.
  const linkRes = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
  });
  if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
    // Rul revisionsrækken tilbage — sessionen blev aldrig udleveret.
    await supabaseAdmin
      .from("impersonation_log_lago")
      .update({ ended_at: new Date().toISOString(), ended_reason: "unknown" })
      .eq("id", logInsert.data.id);
    const msg =
      linkRes.error?.message ??
      "generateLink returnerede intet hashed_token";
    return jsonResponse(
      { error: `Kunne ikke udstede magic-link: ${msg}` },
      500,
    );
  }

  const expiresAt = new Date(
    new Date(logInsert.data.started_at).getTime() +
      SESSION_TTL_MINUTES * 60 * 1000,
  );

  return jsonResponse({
    token_hash: linkRes.data.properties.hashed_token,
    log_id: logInsert.data.id,
    expires_at: expiresAt.toISOString(),
    target: {
      user_id: targetUserId,
      sales_id: targetSalesId,
      full_name: targetFullName,
      email: targetEmail,
    },
  });
});
