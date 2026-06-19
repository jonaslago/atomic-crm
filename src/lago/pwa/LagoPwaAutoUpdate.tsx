// @ts-expect-error -- vite-plugin-pwa's virtual module ships types via
// `vite-plugin-pwa/client`, but the @types reference isn't wired into this
// project. The hook itself is stable runtime API.
import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";

/**
 * Silent PWA auto-update: when a new service-worker version is available
 * we re-call updateServiceWorker(true), which performs `skipWaiting` on
 * the new worker AND triggers a `window.location.reload()` so the tab
 * immediately picks up the new bundle. Salespeople don't have to
 * hard-refresh after a LAGO deploy.
 *
 * Mounted once near the React root.
 */
export function LagoPwaAutoUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
  });

  const [shouldRefresh] = needRefresh;

  useEffect(() => {
    if (shouldRefresh) {
      updateServiceWorker(true);
    }
  }, [shouldRefresh, updateServiceWorker]);

  return null;
}
