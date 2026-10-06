import { useState } from "react";
import { X } from "lucide-react";
import { Icon } from "@/lago/ui/Icon";
import { isIosWithoutPwa, isPushSupported } from "./pushSubscription";

/**
 * §100-3 (6. okt 2026): iOS PWA banner.
 *
 * On iPhone in a regular tab, push notifications are not available.
 * The app must be added to the home screen (Safari → Share → Add to
 * Home Screen). This banner tells the user — otherwise silence is
 * perceived as a bug.
 *
 * Shown once per session. Dismissed with X.
 */
export function IosPwaBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Only show on iOS without PWA, and only if push isn't supported
  if (dismissed) return null;
  if (!isIosWithoutPwa()) return null;
  if (isPushSupported()) return null;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--st-amber-fg)]/30 bg-[var(--st-amber-bg)] px-4 py-2 text-sm text-[var(--fg)]">
      <span className="flex-1">
        Beskeder kræver, at appen lægges på hjemmeskærmen: Del → Føj til
        hjemmeskærm.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 hover:bg-[var(--surface-1)]"
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  );
}
