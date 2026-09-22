/**
 * Brief 57 §0c (17. sep 2026) · bundle-hash som versionsnummer.
 *
 * Vite bygger hoved-bundlen som `assets/index-<hash>.js`. Vi læser
 * hash'en fra det aktuelle <script>-tag ved runtime — så
 * versionsnummeret matcher præcis hvad browseren har indlæst.
 *
 * "Version: D2eQQYoT" vises i Indstillinger (så Jonas kan slå op
 * hvad hans telefon kører uden en Mac) og i WidgetShell-fejlbeskeder
 * (så et skærmbillede bærer versionen med).
 *
 * Fallback: "?" hvis vi ikke kan finde hash — det er bedre end at
 * skjule tallet, fordi selve fraværet er et signal.
 */

let cached: string | null = null;

/**
 * Brief 77 (22. sep 2026): serverens bundle-hash — poll'et fra
 * `/index.html`, ikke det browseren har indlæst. Bruges begge steder
 * hvor vi skal skelne mellem udrulning og nedbrud:
 *
 *  - `LagoPwaAutoUpdate` (stribe) viser knap når serverens hash ≠
 *    getAppVersion()
 *  - `LagoErrorFallback` (fejlgrænse) siger "Ny version — genindlæs"
 *    når serverens hash ≠ getAppVersion() på fangetidspunktet
 *
 * Returnerer null hvis serveren ikke svarer (offline eller CDN-fejl);
 * caller skal håndtere det som "ikke i stand til at skelne".
 */
export async function fetchServerBundleHash(): Promise<string | null> {
  try {
    const url = `/index.html?_v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function getAppVersion(): string {
  if (cached) return cached;
  if (typeof document === "undefined") {
    cached = "?";
    return cached;
  }
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src*="index-"]',
  );
  for (const s of scripts) {
    const m = s.src.match(/index-([A-Za-z0-9_-]+)\.js/);
    if (m) {
      cached = m[1];
      return cached;
    }
  }
  cached = "?";
  return cached;
}
