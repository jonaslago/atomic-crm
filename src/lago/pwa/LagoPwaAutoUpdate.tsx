// @ts-expect-error -- vite-plugin-pwa's virtual module ships types via
// `vite-plugin-pwa/client`, but @types isn't wired in this project.
import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  fetchServerBundleHash,
  getAppVersion,
} from "@/lago/layout/useAppVersion";

const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Brief 70 (21. sep 2026): stribe + knap kobles til SAMME kilde —
 * bundle-hash i den udrullede index.html. SW-baseret detection var
 * usand i praksis: `needRefresh` fra useRegisterSW kunne stå true
 * mens registration.waiting var null, og Genindlæs (updateServiceWorker)
 * sendte SKIP_WAITING til null-worker og gjorde intet. Sælgeren så en
 * knap uden effekt og ingen fejl.
 *
 * Nu:
 *   1. Vi poll'er /index.html?_v=... (no-store) hvert 60 sek + ved
 *      visibilitychange. Regex-parser bundle-hash ud af <script src>.
 *   2. Stribe vises hvis serverens hash ≠ det, browseren indlæste
 *      (getAppVersion). Én kilde — striben kan ikke lyve.
 *   3. Genindlæs kalder location.replace(url + ?_v=timestamp), som
 *      forcer ny fetch af index.html og alle assets. Uafhaengig af
 *      SW-tilstand. SW's precache + skipWaiting/clientsClaim gør deres
 *      i baggrunden, men UI'en er ikke afhaengig af dem.
 *   4. Mislykkes reload (sjaeldent — offline midt i klik), toaster vi
 *      med versionsnummer, jf. brief 63.
 */

// Brief 77 (22. sep 2026): fetchServerBundleHash er flyttet til
// useAppVersion.ts så både striben og fejlgrænsen kan bruge samme
// kilde — de to skærme skal svare på det samme spørgsmål: er der
// kommet en ny version siden vi lastede?

export function LagoPwaAutoUpdate() {
  // Vi kalder useRegisterSW ALENE for at faa SW registreret
  // (registerType: "prompt" i vite.config betyder plugin'et ikke gør
  // det selv). Vi bruger IKKE dens needRefresh/updateServiceWorker —
  // det var netop dem, brief 70 fandt uoverensstemmelser med.
  useRegisterSW({ immediate: true });

  const [serverHash, setServerHash] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const currentHash = useRef(getAppVersion());

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const hash = await fetchServerBundleHash();
      if (cancelled) return;
      if (hash && hash !== currentHash.current) {
        setServerHash(hash);
      } else {
        // Striben maa ikke staa naar der ikke er noget at hente.
        setServerHash(null);
      }
    };
    // Poll straks + hvert minut + ved tab-genoptagelse.
    void check();
    const iv = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Ryd dismissed-state naar serverHash aendrer sig (dvs. en ny ny
  // version dukker op efter den forrige blev afvist).
  useEffect(() => {
    if (serverHash) setDismissed(false);
  }, [serverHash]);

  const hasUpdate = serverHash != null;
  if (!hasUpdate || dismissed) return null;

  const handleReload = () => {
    setReloading(true);
    try {
      // location.replace forcer ny fetch af index.html + assets
      // (query-strengen sikrer det ogsaa mod ekstra HTTP-caching).
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      setReloading(false);
      toast.error("Kunne ikke hente den nye version", {
        description: `Luk appen helt og aabn den igen. Version ${getAppVersion()}.`,
      });
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      // Brief 70 tillæg B (21. sep 2026): pointer-events-auto er
      // KRITISK. En Radix-dialog (kundepreview, Registrér-modalen,
      // kortets ark) sætter pointer-events:none på <body> mens den er
      // open, og kun portal-indholdet får auto igen. Uden den her
      // klasse arver striben "none" — den er synlig, men trykket går
      // TVÆRS IGENNEM og rammer den knap i dialogen der ligger under.
      // Jonas' telefon ringede op til en kunde 21. sep fordi han
      // trykkede paa "Genindlaes" mens preview var open og trykket
      // ramte "Ring op". En stribe der er gennemtraengelig er farligere
      // end en der ikke virker.
      className="fixed inset-x-0 bottom-0 z-[60] pointer-events-auto flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <span className="text-[length:var(--t-sec)] font-medium text-[var(--fg)]">
        Ny version klar
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 rounded-[var(--r-2)] px-3 text-[length:var(--t-sec)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
        >
          Senere
        </button>
        <button
          type="button"
          onClick={handleReload}
          disabled={reloading}
          className="min-h-11 rounded-[var(--r-2)] bg-[var(--ink)] px-4 text-[length:var(--t-sec)] font-medium text-white hover:bg-[var(--ink)]/90 disabled:opacity-60"
        >
          {reloading ? "Henter…" : "Genindlæs"}
        </button>
      </div>
    </div>
  );
}
