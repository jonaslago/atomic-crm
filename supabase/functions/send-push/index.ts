/**
 * §100 (6. okt 2026): send push notification to a user's devices.
 *
 * Called from other edge functions or from the client when a task is
 * assigned or an order follow-up is created. Reads subscriptions from
 * push_subscriptions_lago, sends via Web Push protocol with VAPID.
 *
 * Expired subscriptions (410 Gone) are deleted automatically.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:crm-automate@lago.dk";

interface PushPayload {
  /** sales_id(s) to notify */
  recipients: number[];
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** URL to open on click */
  url?: string;
  /** Tag for grouping (replaces previous with same tag) */
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: PushPayload = await req.json();
    if (!payload.recipients?.length || !payload.title) {
      return new Response(
        JSON.stringify({ error: "recipients and title required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch all subscriptions for the recipients
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions_lago")
      .select("id, endpoint, p256dh, auth, sales_id")
      .in("sales_id", payload.recipients);
    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, expired: 0, detail: "no subscriptions" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Import web-push compatible library for Deno
    // Using raw Web Push protocol with VAPID
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      tag: payload.tag,
    });

    let sent = 0;
    let expired = 0;
    const errors: string[] = [];

    for (const sub of subs as Array<{
      id: number;
      endpoint: string;
      p256dh: string;
      auth: string;
      sales_id: number;
    }>) {
      try {
        // Use the web-push npm package via Deno
        const { default: webpush } = await import("npm:web-push@3.6.7");
        webpush.setVapidDetails(
          VAPID_SUBJECT,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
        );

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          // Subscription expired — delete it
          await supabaseAdmin
            .from("push_subscriptions_lago")
            .delete()
            .eq("id", sub.id);
          expired++;
        } else {
          errors.push(
            `${sub.endpoint.slice(0, 50)}: ${(err as Error)?.message ?? String(err)}`,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, expired, errors: errors.slice(0, 5) }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
