/**
 * §95 §6 / §96 §5.4 — vagthund.
 *
 * Selvstændigt job, uafhængigt af postkasse-læseren.
 * Kigger på ét tal: hvornår kørte sidste vellykkede import?
 * Er det over 8 timer siden, sendes der mail.
 *
 * Kører dagligt kl. 06:00 via pg_cron.
 * Kan også kaldes manuelt for test.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const ALERT_THRESHOLD_HOURS = 8;
const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") ?? "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") ?? "";
const SEND_FROM = "crm-automate@lago.dk";

async function fetchAlertRecipients(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("lago_settings")
    .select("value")
    .eq("key", "alert_recipients")
    .maybeSingle();
  if (data?.value && Array.isArray(data.value)) {
    return data.value.filter(
      (v: unknown) => typeof v === "string" && v.includes("@"),
    );
  }
  return [];
}

async function getGraphToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function sendAlert(subject: string, body: string): Promise<void> {
  const recipients = await fetchAlertRecipients();
  if (recipients.length === 0) return;
  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/users/${SEND_FROM}/sendMail`;
  const mailBody = {
    message: {
      subject,
      body: { contentType: "Text", content: body },
      toRecipients: recipients.map((email) => ({
        emailAddress: { address: email },
      })),
      internetMessageHeaders: [
        {
          name: "X-Auto-Response-Suppress",
          value: "All",
        },
      ],
    },
    saveToSentItems: false,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mailBody),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendMail error ${res.status}: ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Find the last successful import
    const { data, error } = await supabaseAdmin
      .from("sync_runs_lago")
      .select("koert_at, datasaet, note")
      .not("note", "ilike", "%fejlet%")
      .order("koert_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const now = new Date();
    const lastRun = data?.koert_at ? new Date(data.koert_at) : null;
    const hoursSince = lastRun
      ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (hoursSince > ALERT_THRESHOLD_HOURS) {
      const lastStr = lastRun
        ? lastRun.toISOString().replace("T", " ").slice(0, 19)
        : "aldrig";
      const subject = `⚠️ CRM-import: ${Math.round(hoursSince)} timer siden sidste kørsel`;
      const body = [
        `Sidste vellykkede import: ${lastStr}`,
        `Datasæt: ${data?.datasaet ?? "ukendt"}`,
        `Timer siden: ${hoursSince.toFixed(1)}`,
        `Tærskel: ${ALERT_THRESHOLD_HOURS} timer`,
        "",
        "Tjek postkassen crm-automate@lago.dk og funktionsloggen i Supabase.",
        "Den manuelle import virker stadig: crm.lago.dk → Indstillinger → Import.",
      ].join("\n");

      await sendAlert(subject, body);

      return new Response(
        JSON.stringify({
          status: "alert_sent",
          hoursSince: hoursSince.toFixed(1),
          lastRun: lastStr,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        hoursSince: hoursSince.toFixed(1),
        lastRun: lastRun?.toISOString() ?? null,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
