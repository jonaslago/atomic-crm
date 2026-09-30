import { useRef, useState, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";

/**
 * Brief 67 (21. sep 2026) · Træk ned for at opdatere.
 *
 * PWA-installationen fjernede Safaris egen træk-ned. Vi laegger den ind
 * igen paa Hjem, Kunder, Kontakter, Aktiviteter og kundekortet — men
 * IKKE paa Kort (kortet ejer sine egne pan-bevaegelser) og IKKE inde i
 * modaler (en gestus midt i en indtastning maa aldrig kunne kassere det
 * nogen skriver).
 *
 * Fysik:
 *   - Aktiv kun ved scrollTop = 0 (rammer kun toppen af siden)
 *   - Modstand 0.5 — indholdet foelger halvvejs. Det foeles som en
 *     gummisnor, ikke et panel man skubber.
 *   - Taerskel 60 px — spinneren bliver fuldtonet ved threshold
 *   - Minimum 400 ms visning, ogsaa naar svaret kommer paa 50 —
 *     en opdatering der ikke kan maerkes foeles som om den ikke skete
 *   - Ved fejl toaster vi (brief 63): gestussen fortier ikke noget
 *
 * Blokeret naar:
 *   - En Radix-dialog (dialog, sheet, popover) staar aaben — detekteret
 *     via [data-state="open"][role="dialog"]. Dette daekker
 *     RegistrerModal, PlanVisitDialog, BesoegsfrekvensDialog osv.
 *   - Prop `disabled` er sat (fx Kort-siden)
 */

const THRESHOLD = 60;
const RESISTANCE = 0.5;
const MIN_SHOW_MS = 400;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
  /** Fx Kort-siden saetter denne til true for at slaa gestus fra. */
  disabled?: boolean;
}

function hasOpenDialog(): boolean {
  return !!document.querySelector('[data-state="open"][role="dialog"]');
}

export function PullToRefresh({
  onRefresh,
  children,
  disabled,
}: PullToRefreshProps) {
  const startYRef = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Lyt på window scroll for at cleare pull hvis brugeren scroller væk
  // fra top under et træk (racy edge case).
  useEffect(() => {
    if (!refreshing && startYRef.current == null && pull !== 0) {
      setPull(0);
    }
  }, [refreshing, pull]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    if (hasOpenDialog()) return;
    // Kun aktiv naar viewporten allerede er ved toppen.
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current == null || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      // Bevaeger fingeren opad — annullér traekket, lad browseren
      // scrolle normalt.
      setPull(0);
      startYRef.current = null;
      return;
    }
    setPull(delta * RESISTANCE);
    // Undertryk iOS' bounce-scroll saa vores translateY er den eneste
    // effekt paa skaermen.
    if (delta > 5 && e.cancelable) e.preventDefault();
  };

  const finishRefresh = async () => {
    const start = Date.now();
    try {
      await onRefresh();
    } catch (err) {
      // Brief 63: fejl fortiges ikke. Toast forbliver over spinneren.
      toast.error("Kunne ikke opdatere", {
        description: readErrorMessage(err),
      });
    } finally {
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - start));
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, wait);
    }
  };

  const onTouchEnd = () => {
    if (startYRef.current == null) return;
    const currentPull = pull;
    startYRef.current = null;
    if (currentPull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      void finishRefresh();
    } else {
      setPull(0);
    }
  };

  const spinnerReady = pull >= THRESHOLD || refreshing;
  const spinnerOpacity = Math.min(1, (pull + (refreshing ? THRESHOLD : 0)) / THRESHOLD);
  const translateY = refreshing ? THRESHOLD : pull;
  const showIndicator = pull > 0 || refreshing;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="relative"
    >
      {showIndicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 items-center justify-center"
          style={{
            top: 8,
            transform: `translate(-50%, ${translateY - THRESHOLD}px)`,
            opacity: spinnerOpacity,
            transition: startYRef.current == null ? "transform 200ms ease-out, opacity 150ms" : "none",
          }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] shadow-sm"
          >
            <Icon
              icon={Loader2}
              className={
                refreshing
                  ? "h-4 w-4 animate-spin text-[var(--fg)]"
                  : spinnerReady
                    ? "h-4 w-4 text-[var(--fg)]"
                    : "h-4 w-4 text-[var(--fg-2)]"
              }
            />
          </div>
        </div>
      )}
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          transition: startYRef.current == null ? "transform 200ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Brief 67 §3: "kun den aktuelle skærms forespørgsler". React Query's
 * `invalidateQueries({ refetchType: "active" })` gør præcis dét — kun
 * mounted queries refetches; øvrige cachede queries markeres stale men
 * refetches ikke nu. Så cachen "smides ikke væk", vi opdaterer bare
 * det, brugeren faktisk kigger på.
 */
export function LagoPullToRefresh({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const onRefresh = async () => {
    await qc.invalidateQueries({ refetchType: "active" });
  };
  return (
    <PullToRefresh onRefresh={onRefresh} disabled={disabled}>
      {children}
    </PullToRefresh>
  );
}
