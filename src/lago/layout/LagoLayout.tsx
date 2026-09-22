import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { matchPath, Navigate, useLocation } from "react-router";

import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

import { useConfigurationLoader } from "@/components/atomic-crm/root/useConfigurationLoader";

import { LagoHeader } from "./LagoHeader";
import { LagoScrollRestoration } from "./LagoScrollRestoration";
import { TestdataBanner } from "./TestdataBanner";
import { ImpersonationBar } from "@/lago/impersonation/ImpersonationBar";
import { LagoSalgsudvikling } from "@/lago/salesdev/LagoSalgsudvikling";
import { KortPage } from "@/lago/kort/KortPage";
import { LagoSettingsPage } from "@/lago/settings/LagoSettingsPage";
import { LagoAktiviteter } from "@/lago/aktiviteter/LagoAktiviteter";
import { MaintenanceGate } from "@/lago/appstate/MaintenanceGate";

/**
 * LAGO desktop layout. Mirrors the shape of the upstream Layout (Header
 * + <main> + Notification wrappers) but swaps in the LagoHeader with the
 * mid-fi tab order and intercepts /salgsudvikling to render the LAGO
 * sales-development page — the app's Admin router does not know about it
 * because we register no upstream Resource for that path, so this layout
 * short-circuits before its children get to see it.
 */
export function LagoLayout({ children }: { children: ReactNode }) {
  useConfigurationLoader();
  const location = useLocation();
  const isSalesDev = !!matchPath("/salgsudvikling/*", location.pathname);
  const isKort = !!matchPath("/kort", location.pathname);
  // Brief 59 §2 (17. sep 2026): #/felt/* er dødt, men vejledningen som
  // sælgerne har fået udleveret peger stadig på #/felt/dagens. Redirect
  // til #/kort så et gammelt link ikke bliver en blank skærm i en dør.
  const isLegacyFelt = !!matchPath("/felt/*", location.pathname);
  const isLagoSettings = !!matchPath("/indstillinger/*", location.pathname);
  const isAktiviteter = !!matchPath("/aktiviteter/*", location.pathname);
  if (isLegacyFelt) {
    return <Navigate to="/kort" replace />;
  }
  return (
    <MaintenanceGate>
      <LagoScrollRestoration />
      {/* Brief 27 §3: bar'en står øverst, over headeren, så den ikke
          kan glide ud af syne når man scroller. Sticky top-0 z-50
          fastholder placeringen på tværs af navigation. */}
      <ImpersonationBar />
      <LagoHeader />
      <TestdataBanner />
      {/* Brief 38 §5 (16. sep 2026): bundpolstring der tager højde for
          iOS Safaris flydende værktøjslinje. `env(safe-area-inset-bottom)`
          er 0 på laptop og ~34 px på iPhone; +1.5rem giver luft så det
          sidste widget-indhold ikke ligger klemt op ad browser-chromen.
          Gælder alle skærme, ikke kun Hjem. */}
      {/* Brief 54 §2b (17. sep 2026): under 480 px reduceres padding til
          px-2 så mobil-lister får bredden — det er 8 px mindre af 390 =
          16 px ekstra til kundenavnet. Fra 480 px: px-4 som før. */}
      <main
        className="mx-auto max-w-screen-2xl px-2 min-[480px]:px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        id="main-content"
      >
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
            {isKort ? (
              <KortPage />
            ) : isSalesDev ? (
              <LagoSalgsudvikling />
            ) : isLagoSettings ? (
              <LagoSettingsPage />
            ) : isAktiviteter ? (
              <LagoAktiviteter />
            ) : (
              children
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </MaintenanceGate>
  );
}
