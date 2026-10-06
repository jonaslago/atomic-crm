import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * §100 (6. okt 2026): push notification subscription management.
 *
 * The permission is asked the first time the user does something that
 * could generate a notification — when they send a task or write a
 * follow-up. At that moment the question makes sense, and they say yes.
 *
 * A browser that got "no" once never asks again. That's why timing
 * matters more than code.
 */

// Public VAPID key — safe to embed, it's the public half
const VAPID_PUBLIC_KEY =
  "BF32hONseqFVwwVRCbKI8RfoJDA2NgpG_pL5ZHaNbS-DGTG2FFfmjiFN_zfiK5Cb58Zxu7I0bwZ2HIMrZF5v248";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** True if push notifications are supported in this browser */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/** True if this is iOS in a regular tab (not installed to home screen) */
export function isIosWithoutPwa(): boolean {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Standalone = installed on home screen
  const isStandalone =
    "standalone" in navigator &&
    (navigator as { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

/** Subscribe to push and save the subscription to the database */
export async function subscribeToPush(salesId: number): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("push_subscriptions_lago").upsert(
      {
        sales_id: salesId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("Push subscription save failed:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

/** Check if the user already has an active subscription */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub != null;
  } catch {
    return false;
  }
}
