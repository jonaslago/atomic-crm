import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const LAST_LIST_KEY = "lago:lastListUrl";
const SCROLL_KEY_PREFIX = "lago:scrollY:";
const SHOW_ROUTE = /\/companies\/\d+\/show/;

function scrollKey(pathname: string): string {
  return `${SCROLL_KEY_PREFIX}${pathname}`;
}

/**
 * Brief 74 §2 + tillæg A (22. sep 2026) · scroll-restoration ved rute-ændring.
 *
 * Sælgeren ruller ned i kundelisten, klikker en kunde nederst, lander
 * på kundekortet — men skærmen viser Stamdata fordi den nye rute arver
 * listens scrollY. Navnet, kreditspærre-chippen og handlingsrækken er
 * alle over kanten.
 *
 * Regler:
 * - Ny frem-navigation (PUSH/REPLACE uden restoreListScroll):
 *   rul til toppen — brugeren er kommet et nyt sted hen.
 * - Browser-back (POP): restaurér scrollY fra sessionStorage.
 * - Programmatisk "tilbage" (PUSH med state.restoreListScroll):
 *   restaurér som var det POP — sælgeren skal ikke miste sin plads,
 *   fordi rettelsen er implementeret med state frem for history.back()
 *   (som ville falde ud af appen, hvis kundekortet blev åbnet direkte
 *   via bogmærke).
 *
 * Sidste kendte liste-URL gemmes separat under `lago:lastListUrl` så
 * kundekortets Tilbage-knap kan lande på præcis den filtrerede liste
 * sælgeren kom fra — ikke bare "/companies".
 */
export function LagoScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const pathname = location.pathname;
  const search = location.search;
  const currentPath = useRef(pathname);

  useEffect(() => {
    currentPath.current = pathname;

    // Gem sidste liste-URL (pathname + search) så Tilbage-knappen kan
    // lande præcis dér. Kundekort-ruter tæller ikke som liste.
    if (!SHOW_ROUTE.test(pathname)) {
      sessionStorage.setItem(LAST_LIST_KEY, pathname + search);
    }

    const stateRestore =
      (location.state as { restoreListScroll?: boolean } | null)
        ?.restoreListScroll === true;
    const shouldRestore = navType === "POP" || stateRestore;

    if (shouldRestore) {
      const raw = sessionStorage.getItem(scrollKey(pathname));
      const y = raw ? Number(raw) : 0;
      // Vent på næste frame så DOM er lagt ud — ellers ryger scrollY
      // tabt fordi document.body ikke er høj nok endnu.
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
    // location.state indgår i deps så Tilbage-knappens PUSH med state
    // ikke misses. search er med for lastListUrl-opdatering.
  }, [pathname, search, navType, location.state]);

  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem(
        scrollKey(currentPath.current),
        String(window.scrollY),
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}

/**
 * Sidste liste-URL sælgeren var på (pathname + search).
 * Bruges af kundekortets Tilbage-knap så filteret ikke går tabt.
 * Fallback til "/companies" hvis kundekortet er åbnet direkte via
 * bogmærke eller notifikation — sælgeren skal ikke falde ud af appen.
 */
export function getLastListUrl(): string {
  return sessionStorage.getItem(LAST_LIST_KEY) ?? "/companies";
}
