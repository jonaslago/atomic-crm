import { useEffect, useState, type ReactNode } from "react";

import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";

import { MaintenanceBanner } from "./MaintenanceBanner";
import { MaintenancePage } from "./MaintenancePage";
import { useAppState } from "./useAppState";

/**
 * Brief 57 · gate for vedligeholdelsestilstand.
 *
 * Admin (lago_role='admin') ser aldrig sælger-skærmen — kun en amber-
 * stribe øverst med "Luk op igen". Sælgere ser HELE skærmen.
 *
 * §5: en igangværende Registrér-modal må ikke ryge. Vi tjekker om
 * Radix har en åben `[role="dialog"]` — hvis ja, udskyder vi skærmen
 * indtil dialogen lukkes (næste tjek finder ingen åben dialog). At
 * tage en note fra en sælger midt i indtastning er værre end at lade
 * ham gemme den ét sekund for sent.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { state, isMaintenance } = useAppState();
  const { isAdmin } = useIsLagoAdmin();
  const hasOpenDialog = useHasOpenDialog();

  // Admin: pass-through + stribe. Sælger: skærm hvis maintenance-vindue
  // er aktivt OG ingen dialog blokerer for indhentet arbejde.
  if (isMaintenance && !isAdmin && !hasOpenDialog) {
    return <MaintenancePage state={state} />;
  }
  return (
    <>
      {isMaintenance && isAdmin && <MaintenanceBanner state={state} />}
      {children}
    </>
  );
}

/**
 * Radix Dialog og Sheet sætter `data-state="open"` på deres root-node.
 * Vi observerer med MutationObserver så vi opdager både åbning og
 * lukning uden at pol i en render-loop.
 */
function useHasOpenDialog(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const found = document.querySelector(
        '[role="dialog"][data-state="open"]',
      );
      setOpen(!!found);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => obs.disconnect();
  }, []);
  return open;
}
