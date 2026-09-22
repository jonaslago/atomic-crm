import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Brief 74 §2 (22. sep 2026) · scroll-restoration ved rute-ændring.
 *
 * Problem: sælgeren ruller ned i kundelisten, klikker en kunde nederst,
 * lander på kundekortet — men skærmen viser Stamdata fordi den nye
 * rute arver listens scrollY. Navnet, kreditspærre-chippen og
 * handlingsrækken er alle over kanten.
 *
 * Løsning: ved almindelig frem-navigation (PUSH/REPLACE) rulles til
 * toppen. Ved browser-back (POP) restaureres scrollY fra sessionStorage
 * så kundelisten husker, hvor sælgeren var — én mister ikke sin plads
 * blandt 260 alfabetisk sorterede rækker, fordi han kiggede på én kunde.
 *
 * scrollY gemmes per pathname på hver scroll-event (passive listener,
 * ingen throttling — sessionStorage-writes er billige nok, og
 * lyd-registrering skal være pålidelig når brugeren først vender
 * tilbage måske et minut senere).
 */
export function LagoScrollRestoration() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const currentPath = useRef(pathname);

  useEffect(() => {
    currentPath.current = pathname;
    if (navType === "POP") {
      const raw = sessionStorage.getItem(`lago:scrollY:${pathname}`);
      const y = raw ? Number(raw) : 0;
      // Vent på næste frame så DOM er lagt ud — ellers ryger scrollY
      // tabt fordi document.body ikke er høj nok endnu.
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);

  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem(
        `lago:scrollY:${currentPath.current}`,
        String(window.scrollY),
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
