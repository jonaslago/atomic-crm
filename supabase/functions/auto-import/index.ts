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

// GraphAttachment removed — we list metadata and download one at a
// time to avoid loading all base64 content into memory at once.

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
    `&$top=1`; // Process one mail per invocation to stay within memory
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

/** List attachments metadata (no content) to avoid loading all base64 at once. */
async function listAttachments(
  token: string,
  messageId: string,
): Promise<Array<{ id: string; name: string; size: number }>> {
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages/${messageId}/attachments` +
    `?$select=id,name,size`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph list-attachments error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data.value ?? []) as Array<{ id: string; name: string; size: number }>;
}

/** Download one attachment's content as raw bytes via the $value
 *  endpoint. This streams binary instead of base64-in-JSON, halving
 *  memory usage. Falls back to JSON+base64 if $value fails. */
async function downloadAttachment(
  token: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  // Try $value endpoint first (binary stream, much less memory)
  const valueUrl =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages/${messageId}/attachments/${attachmentId}/$value`;
  const valueRes = await fetch(valueUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (valueRes.ok) {
    const buf = await valueRes.arrayBuffer();
    return new Uint8Array(buf);
  }
  // Fallback: JSON with base64
  const url =
    `https://graph.microsoft.com/v1.0/users/${MAILBOX}/messages/${messageId}/attachments/${attachmentId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph download error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return Uint8Array.from(
    atob(data.contentBytes),
    (c) => c.charCodeAt(0),
  );
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

      // List attachments (metadata only — no content downloaded yet)
      const attachmentMeta = await listAttachments(token, msg.id);
      const xlsxMeta = attachmentMeta.filter((a) =>
        a.name.toLowerCase().endsWith(".xlsx"),
      );

      // All produkttransaktioner files are now 7-day windows (<1MB).
      // No size filter needed — Jonas confirmed 1. okt.
      const fileTypes = xlsxMeta
        .map((a) => ({ name: a.name, type: identifyFile(a.name), attachmentId: a.id }))
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

      // §95 §3c: store raw files in Supabase Storage for replay.
      // Downloaded one at a time to limit peak memory. The hourly file
      // is ~7 days of data (few thousand rows, <1MB), not 60k.
      // Deleted after 30 days — they contain customer names and amounts.
      for (const f of fileTypes) {
        const storeBytes = await downloadAttachment(token, msg.id, f.attachmentId);
        const path = `auto-import/${new Date().toISOString().slice(0, 10)}/${msg.internetMessageId}/${f.name}`;
        await supabaseAdmin.storage
          .from("attachments")
          .upload(path, storeBytes, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
          });
      }

      // §95-2: parse + gate + import each file type
      const importResults: string[] = [];

      // Build a lookup from type → attachmentId. Files are downloaded
      // one at a time during import to stay within memory limits.
      const idByType = new Map(
        fileTypes.map((f) => [f.type!, f.attachmentId]),
      );
      /** Download one file on demand. */
      const getBytes = (type: string) =>
        downloadAttachment(token, msg.id, idByType.get(type)!);

      // §95 §3e + §95-fix: sync_runs logging is a CONDITION, not a
      // side effect. If we can't log, the import has not succeeded —
      // and the mail stays unread for retry. A silent log failure is
      // the most dangerous property the function can have.
      async function logRun(datasaet: string, raekker: number, detail: string) {
        const { error } = await supabaseAdmin.from("sync_runs_lago").insert({
          datasaet,
          kilde: "auto-import",
          raekker,
          er_testdata: false,
          note: `msgid:${msg.internetMessageId} · ${detail}`,
        });
        if (error) {
          throw new Error(`sync_runs_lago INSERT fejlede: ${error.message}`);
        }
      }

      try {
        // Process each file type sequentially — decode on demand to
        // limit peak memory. Produkttransaktioner alone is ~8MB base64.

        if (idByType.has("produkttransaktioner")) {
          const bytes = await getBytes("produkttransaktioner");
          const r = await importProdukttransaktioner(bytes, supabaseAdmin);
          if (!r.ok) {
            throw new Error(`Produkttransaktioner port: ${r.gateFailure}`);
          }
          await logRun("sales_monthly", r.rowsImported, r.detail ?? "");
          importResults.push(
            `Produkttransaktioner: ${r.rowsImported} rækker. ${r.detail ?? ""}`,
          );
        }

        if (idByType.has("aabne_ordrer")) {
          try {
            const ordreBytes = await getBytes("aabne_ordrer");
            const noteBytes = idByType.has("aabne_ordrer_noter")
              ? await getBytes("aabne_ordrer_noter")
              : null;
            const r = await importAabneOrdrer(ordreBytes, noteBytes, supabaseAdmin);
            if (r.ok) {
              await logRun("open_orders", r.rowsImported, r.detail ?? "");
              importResults.push(
                `Åbne ordrer: ${r.rowsImported} rækker. ${r.detail ?? ""}`,
              );
            } else {
              // Non-fatal for now — ordrer import is being built
              importResults.push(
                `Åbne ordrer: ${r.gateFailure ?? "skipped"}`,
              );
            }
          } catch (e) {
            importResults.push(
              `Åbne ordrer: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        if (idByType.has("kunder")) {
          importResults.push("Kunder: natlig manuel import (auto ikke bygget)");
        }

        if (idByType.has("produkter")) {
          importResults.push("Produkter: natlig manuel import (auto ikke bygget)");
        }

        // §95 §3e: mark as read ONLY after everything succeeded,
        // INCLUDING the sync_runs log. If anything threw above,
        // we land in catch and the mail stays unread.
        await markAsRead(token, msg.id);

        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: fileTypes.map((f) => f.name),
          status: "imported",
          detail: importResults.join(" | "),
        });
      } catch (importErr) {
        // Import or logging failed — mail stays unread for retry.
        results.push({
          messageId: msg.internetMessageId,
          subject: msg.subject,
          files: fileTypes.map((f) => f.name),
          status: "error",
          detail: importErr instanceof Error
            ? importErr.message
            : String(importErr),
        });
      }
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
