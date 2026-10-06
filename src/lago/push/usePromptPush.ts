import { useCallback, useRef } from "react";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import {
  hasActiveSubscription,
  isPushSupported,
  subscribeToPush,
} from "./pushSubscription";

/**
 * §100-7 (6. okt 2026): prompt for push permission at the right moment.
 *
 * Called after the user sends a task or writes a follow-up — the first
 * time they do something that could generate a notification. At that
 * moment the question makes sense, and they say yes.
 *
 * Only prompts once per session. Does nothing if already subscribed,
 * if push is not supported, or if the user already denied.
 */
export function usePromptPush(): () => void {
  const salesId = useActorSalesId();
  const prompted = useRef(false);

  return useCallback(async () => {
    if (prompted.current) return;
    if (!salesId) return;
    if (!isPushSupported()) return;

    prompted.current = true;

    // Already subscribed? Nothing to do.
    if (await hasActiveSubscription()) return;

    // Already denied? Don't ask again (browser won't let us anyway).
    if (Notification.permission === "denied") return;

    // Ask
    await subscribeToPush(salesId);
  }, [salesId]);
}
