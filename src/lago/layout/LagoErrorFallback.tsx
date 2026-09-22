import { useEffect, useState } from "react";
import type { FallbackProps } from "react-error-boundary";

import {
  fetchServerBundleHash,
  getAppVersion,
} from "@/lago/layout/useAppVersion";

/**
 * Brief 77 (22. sep 2026) · fejlgrænse der ved om der er kommet en
 * ny version.
 *
 * Baggrund: hver ghpages:deploy udskifter `index-<hash>.js` og sletter
 * de gamle chunks. En åben fane der lazy-loader et modul efter deploy
 * får en 404, importen fejler, og fejlgrænsen viser "Noget gik galt".
 * Den forsvinder ved genindlæsning — så det ligner et flakset nedbrud.
 *
 * Vi har allerede bundle-hash-pollen fra brief 70. Fejlgrænsen bruger
 * samme kilde: er serverens hash ≠ det browseren har indlæst, er
 * fejlen næsten sikkert en chunk-fejl fra udrulning. Så siger vi det.
 *
 * Vi genindlæser IKKE af os selv (brief 42 — en sælger kan stå midt
 * i en indtastning; automatik ville trumfe den). Trykket skal komme
 * fra et menneske.
 *
 * Versionsnummeret står nederst så et skærmbillede bærer det med
 * (brief 63).
 */

type CheckState =
  | { kind: "checking" }
  | { kind: "newVersion"; serverHash: string }
  | { kind: "sameVersion" }
  | { kind: "offline" };

export function LagoErrorFallback({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  const [state, setState] = useState<CheckState>({ kind: "checking" });
  const currentHash = getAppVersion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverHash = await fetchServerBundleHash();
      if (cancelled) return;
      if (serverHash === null) {
        setState({ kind: "offline" });
      } else if (serverHash !== currentHash) {
        setState({ kind: "newVersion", serverHash });
      } else {
        setState({ kind: "sameVersion" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentHash]);

  const handleReload = () => {
    // Samme mekanik som stribens Genindlæs (brief 70): forcer ny fetch
    // af index.html + alle assets via cache-buster query.
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  };

  const errorMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as Error).message)
      : String(error ?? "");

  const isNewVersion = state.kind === "newVersion";
  const title = isNewVersion ? "Der er kommet en ny version" : "Noget gik galt";
  const body = isNewVersion
    ? "Genindlæs for at fortsætte."
    : state.kind === "checking"
      ? "Tjekker om det er en opdatering …"
      : state.kind === "offline"
        ? "Kunne ikke tjekke serveren. Prøv at genindlæse — er problemet der stadig, sig til."
        : "Det er en rigtig fejl, ikke en opdatering. Prøv igen, og sig til hvis den kommer tilbage.";

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 rounded-[var(--r-3)] border border-[var(--line)] bg-[var(--surface)] p-6 mt-8">
      <h1 className="text-lg font-semibold text-[var(--fg)]">{title}</h1>
      <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">{body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {isNewVersion ? (
          <button
            type="button"
            onClick={handleReload}
            className="min-h-11 rounded-[var(--r-2)] bg-[var(--ink)] px-4 text-[length:var(--t-sec)] font-medium text-white hover:bg-[var(--ink)]/90"
          >
            Genindlæs
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="min-h-11 rounded-[var(--r-2)] bg-[var(--ink)] px-4 text-[length:var(--t-sec)] font-medium text-white hover:bg-[var(--ink)]/90"
            >
              Prøv igen
            </button>
            <button
              type="button"
              onClick={handleReload}
              className="min-h-11 rounded-[var(--r-2)] border border-[var(--line)] px-4 text-[length:var(--t-sec)] font-medium text-[var(--fg-2)] hover:bg-[var(--surface-2)]"
            >
              Genindlæs
            </button>
          </>
        )}
      </div>
      {errorMessage && !isNewVersion && (
        <pre className="mt-2 max-h-40 w-full overflow-auto rounded-[var(--r-2)] bg-[var(--surface-1)] p-2 text-[length:var(--t-meta)] text-[var(--fg-3)] whitespace-pre-wrap break-words">
          {errorMessage}
        </pre>
      )}
      {/* Brief 77 §2: versionsnummeret skal med på fejlskærmen, så et
          skærmbillede bærer versionen — Jonas kunne ikke sige om han
          så fejlen på nye eller forrige bundle. */}
      <p className="mt-2 text-[length:var(--t-meta)] text-[var(--fg-3)]">
        Version {currentHash}
        {state.kind === "newVersion" && ` → ${state.serverHash}`}
      </p>
    </div>
  );
}
