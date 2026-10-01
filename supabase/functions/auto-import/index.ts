/**
 * §95 — postkasse-læseren (1. okt 2026).
 *
 * Edge Function invoked on a cron schedule (every 10 minutes).
 * Polls crm-automate@lago.dk via Microsoft Graph for unread emails
 * from noreply@onestopreporting.com with subject starting with
 * "Resultater fra Publisher-job Data til CRM".
 *
 * For each unread email:
 *   1. Check internetMessageId for idempotency
 *   2. Download XLSX attachments to Supabase Storage
 *   3. Parse each file with the existing parsers
 *   4. Run gates (§95 §4) — fail = skip, keep mail unread
 *   5. Import to database via admin client
 *   6. Mark mail as read
 *   7. Send status report
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  importProdukttransaktioner,
  importAabneOrdrer,
  importKunder,
} from "./importers.ts";

// Microsoft Graph constants — secrets from Supabase env
const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") ?? "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") ?? "";
const MAILBOX = "crm-automate@lago.dk";
const SENDER_FILTER = "noreply@onestopreporting.com";
const SUBJECT_PREFIX = "Resultater fra Publisher-job Data til CRM";

// File name → import type mapping
const FILE_MAP: Record<string, string> = {
  "Kundeudtræk": "kunder",
  "Produkter": "produkter",
  "Produkter - udgået": "produkter_udgaaet",
  "Åbne ordrelinier": "aabne_ordrer",
  "Åbne ordrelinier - noter": "aabne_ordrer_noter",
  "Produkttransaktioner": "produkttransaktioner",
};

/** Identify import type from attachment filename. */
function identifyFile(filename: string): string | null {
  // Strip .xlsx extension and match
  const base = filename.replace(/\.xlsx$/i, "").trim();
  for (const [pattern, type] of Object.entries(FILE_MAP)) {
    if (base === pattern) return type;
  }
  return null;
}

// ---------- Microsoft Graph helpers ----------

interface GraphToken {
  access_token: string;
  expires_in: number;
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token error ${res.status}: ${text}`);
  }
  const data: GraphToken = await res.json();
  return data.access_token;
}

interface GraphMessage {
  id: string;
  internetMessageId: string;
  subject: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  from: { emailAddress: { address: string } } | null;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  contentBytes: string; // base64
  size: number;
}

async function fetchUnreadMails(token: string): Promise<GraphMessage[]> {
  // §95: only unread. Sender + subject checked client-side because
  // Graph $filter doesn't reliably support from/emailAddress/address
  // combined with isRead.
  const filter = "isRead eq false";
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=id,internetMessageId,subject,receivedDateTime,hasAttachments,from` +
    `&$orderby=receivedDateTime asc` +
    `&$top=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph messages error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data.value ?? []) as GraphMessage[];
}

async function fetchAttachments(
  token: string,
  messageId: string,
): Promise<GraphAttachment[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages/${messageId}/attachments`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph attachments error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data.value ?? []) as GraphAttachment[];
}

async function markAsRead(token: string, messageId: string): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages/${messageId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph mark-read error ${res.status}: ${text}`);
  }
}

// ---------- Idempotency ----------

async function isAlreadyProcessed(internetMessageId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("sync_runs_lago")
    .select("id", { head: true, count: "exact" })
    .eq("note", `msgid:${internetMessageId}`)
    .limit(1);
  return (data as unknown as number) > 0 || false;
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  // Only allow POST (from cron) or GET (for manual trigger)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Missing MS_GRAPH_* secrets" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const token = await getGraphToken();
    const allMessages = await fetchUnreadMails(token);
    // Client-side sender + subject filter. Graph $filter is unreliable
    // for from/emailAddress/address combined queries.
    const messages = allMessages.filter(
      (m) =>
        m.subject.startsWith(SUBJECT_PREFIX) &&
        (m.from?.emailAddress?.address ?? "").toLowerCase() === SENDER_FILTER,
    );

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_new_mail", checked: new Date().toISOString() }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      messageId: string;
      subject: string;
      files: string[];
      status: "imported" | "skipped" | "error";
      detail?: string;
    }> = [];

    for (const msg of messages) {
      // §95 §3b: idempotency via internetMessageId
      const { count } = await supabaseAdmin
        .from("sync_runs_lago")
        .select("id", { head: true, count: "exact" })
        .ilike("note", `%msgid:${msg.internetMessageId}%`);
      if ((count ?? 0) > 0) {
        // Already processed — mark as read and skip
        await markAsRead(token, msg.id);
        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: [],
          status: "skipped",
          detail: "Already processed (idempotency)",
        });
        continue;
      }

      if (!msg.hasAttachments) {
        await markAsRead(token, msg.id);
        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: [],
          status: "skipped",
          detail: "No attachments",
        });
        continue;
      }

      // Fetch attachments
      const attachments = await fetchAttachments(token, msg.id);
      const xlsxFiles = attachments.filter((a) =>
        a.name.toLowerCase().endsWith(".xlsx"),
      );

      const fileTypes = xlsxFiles
        .map((a) => ({ name: a.name, type: identifyFile(a.name), attachment: a }))
        .filter((f) => f.type != null);

      if (fileTypes.length === 0) {
        await markAsRead(token, msg.id);
        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: xlsxFiles.map((a) => a.name),
          status: "skipped",
          detail: "No recognized XLSX files",
        });
        continue;
      }

      // §95 §1: ordrelinier + noter must come together
      const hasOrdrer = fileTypes.some((f) => f.type === "aabne_ordrer");
      const hasNoter = fileTypes.some((f) => f.type === "aabne_ordrer_noter");
      if (hasOrdrer !== hasNoter) {
        // One without the other — skip both, keep unread
        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: fileTypes.map((f) => f.name),
          status: "error",
          detail: `Parvis-port: ${hasOrdrer ? "ordrer" : "noter"} uden ${hasOrdrer ? "noter" : "ordrer"}. Mail forbliver ulæst.`,
        });
        continue;
      }

      // Store raw files in Supabase Storage for replay
      for (const f of fileTypes) {
        const bytes = Uint8Array.from(
          atob(f.attachment.contentBytes),
          (c) => c.charCodeAt(0),
        );
        const path = `auto-import/${new Date().toISOString().slice(0, 10)}/${msg.internetMessageId}/${f.name}`;
        await supabaseAdmin.storage
          .from("attachments")
          .upload(path, bytes, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
          });
      }

      // §95-2: parse + gate + import each file type
      const importResults: string[] = [];
      let anyFailed = false;

      // Convert attachments to bytes map
      const bytesMap = new Map<string, Uint8Array>();
      for (const f of fileTypes) {
        const bytes = Uint8Array.from(
          atob(f.attachment.contentBytes),
          (c) => c.charCodeAt(0),
        );
        bytesMap.set(f.type!, bytes);
      }

      // Import Produkttransaktioner
      if (bytesMap.has("produkttransaktioner")) {
        try {
          const r = await importProdukttransaktioner(
            bytesMap.get("produkttransaktioner")!,
            supabaseAdmin,
          );
          if (r.ok) {
            importResults.push(
              `Produkttransaktioner: ${r.rowsImported} rækker. ${r.detail ?? ""}`,
            );
            await supabaseAdmin.from("sync_runs_lago").insert({
              datasaet: "sales_monthly",
              kilde: "auto-import",
              raekker: r.rowsImported,
              er_testdata: false,
              note: `msgid:${msg.internetMessageId} · ${r.detail ?? ""}`,
            });
          } else {
            anyFailed = true;
            importResults.push(
              `Produkttransaktioner FEJLET: ${r.gateFailure ?? "ukendt"}`,
            );
          }
        } catch (e) {
          anyFailed = true;
          importResults.push(
            `Produkttransaktioner FEJL: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Import Åbne ordrer + noter (transactional via RPC)
      if (bytesMap.has("aabne_ordrer")) {
        try {
          const r = await importAabneOrdrer(
            bytesMap.get("aabne_ordrer")!,
            bytesMap.get("aabne_ordrer_noter") ?? null,
            supabaseAdmin,
          );
          if (r.ok) {
            importResults.push(
              `Åbne ordrer: ${r.rowsImported} rækker. ${r.detail ?? ""}`,
            );
            await supabaseAdmin.from("sync_runs_lago").insert({
              datasaet: "open_orders",
              kilde: "auto-import",
              raekker: r.rowsImported,
              er_testdata: false,
              note: `msgid:${msg.internetMessageId} · ${r.detail ?? ""}`,
            });
          } else {
            anyFailed = true;
            importResults.push(
              `Åbne ordrer FEJLET: ${r.gateFailure ?? "ukendt"}`,
            );
          }
        } catch (e) {
          anyFailed = true;
          importResults.push(
            `Åbne ordrer FEJL: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Import Kunder (natligt only)
      if (bytesMap.has("kunder")) {
        try {
          const r = await importKunder(
            bytesMap.get("kunder")!,
            supabaseAdmin,
          );
          if (r.ok) {
            importResults.push(
              `Kunder: ${r.rowsImported} rækker. ${r.detail ?? ""}`,
            );
          } else {
            importResults.push(
              `Kunder: ${r.gateFailure ?? "ikke implementeret serverside"}`,
            );
          }
        } catch (e) {
          importResults.push(
            `Kunder FEJL: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Produkter (natligt only) — placeholder
      if (bytesMap.has("produkter")) {
        importResults.push("Produkter: kun natlig manuel import");
      }

      // Mark as read only if no critical failure
      if (!anyFailed) {
        await markAsRead(token, msg.id);
      }

      results.push({
        messageId: msg.internetMessageId,
        subject: msg.subject,
        files: fileTypes.map((f) => f.name),
        status: anyFailed ? "error" : "imported",
        detail: importResults.join(" | "),
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
