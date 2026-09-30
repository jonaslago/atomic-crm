/**
 * LAGO CRM · designsystem-audit — regelsættet
 *
 * Denne fil serialiseres og køres INDE i browseren. Derfor:
 * ingen imports, ingen Node-API'er, kun almindelig DOM.
 *
 * Hver regel returnerer en liste af overtrædelser. Reglerne er hentet
 * direkte fra design/LAGO_Design_System_implementering.md — hvis en regel
 * ændres dér, skal den ændres her samtidig.
 */

export const auditInPage = () => {
  const TAP = 44; // mindste berøringsmål
  const TEXT_MIN = 12; // absolut mindste skriftstørrelse
  const ICON_MIN = 20; // mindste ikon
  const CONTRAST_MIN = 4.5; // WCAG AA
  const GLYPHS = /[→←↑↓×✎☎◈▤⌕☰◎▦⚙🕒✓»«]/u;

  // Berøringsmål betyder noget på en finger, ikke på en mus. Under 1200 px
  // antager vi touch; derover nedgraderes trykmåls-fund til kosmetiske, så
  // rapporten ikke råber op om navigationsknapper på en laptop. Råber den
  // op om alt, holder folk op med at læse den.
  const TOUCH = window.innerWidth < 1200;

  // ---- accepterede undtagelser ------------------------------------------
  //
  // Fund der matcher én af disse regler UDELADES af rapporten. Uden en
  // sådan liste vokser rapporten ved hver kørsel med accepterede fund,
  // og på et tidspunkt holder folk op med at læse den. En audit der
  // råber om noget vi bevidst har besluttet, lærer folk at ignorere den.
  //
  // Hver undtagelse skal have en KLARTEKST-begrundelse. Fjern
  // undtagelsen så snart den underliggende beslutning ændres.
  //
  // Format: { rule, selector, reason } — selector matches via
  // el.matches() ELLER el.closest() (tåler både selve elementet og
  // en parent-container).
  const EXCEPTIONS = [
    {
      rule: "berøringsmål",
      selector: ".maplibregl-ctrl-attrib",
      reason:
        "CARTO-attribution — juridisk krav (kortlicens). 14 px er passende for kildeangivelse; bruges ikke som handling. Beslutning: 10. sep 2026.",
    },
  ];

  const isExcepted = (rule, el) => {
    for (const ex of EXCEPTIONS) {
      if (ex.rule !== rule) continue;
      try {
        if (el.matches(ex.selector) || el.closest(ex.selector)) return true;
      } catch {
        /* dårlig selector — ignorer */
      }
    }
    return false;
  };

  const out = [];
  const add = (severity, rule, detail, el) => {
    if (isExcepted(rule, el)) return;
    out.push({
      severity,
      rule,
      detail,
      where: describe(el),
    });
  };

  function describe(el) {
    if (!el) return "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` — "${txt}"` : ""}`;
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const s = getComputedStyle(el);
    return (
      s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"
    );
  }

  // ---- farve & kontrast -------------------------------------------------
  const parseRgb = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((n) => parseFloat(n));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  function effectiveBg(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parseRgb(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.9) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  const INTERACTIVE =
    'button,a[href],select,textarea,summary,[role="button"],[role="checkbox"],[role="tab"],[data-slot="button"],[data-slot="checkbox"],input:not([type="hidden"])';

  // ---- 1. berøringsmål --------------------------------------------------
  document.querySelectorAll(INTERACTIVE).forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    const type = el.getAttribute("type");
    const isBox = type === "checkbox" || type === "radio";
    const min = isBox ? 24 : TAP;
    if (Math.round(r.height) < min || (isBox && Math.round(r.width) < min)) {
      add(
        TOUCH ? "kritisk" : "kosmetisk",
        "berøringsmål",
        `${Math.round(r.width)}×${Math.round(r.height)} px — kravet er ${isBox ? "24 (boks) + 44 (trykfelt)" : TAP}`,
        el,
      );
    }
  });

  // ---- 2. skriftstørrelse, vægt og kursiv -------------------------------
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length || !el.textContent.trim() || !visible(el)) return;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);

    if (size < TEXT_MIN)
      add("kritisk", "skriftstørrelse", `${size} px — bunden er ${TEXT_MIN}`, el);

    if (s.fontWeight === "600")
      add(
        "bør rettes",
        "vægt 600",
        "findes ikke i Helvetica Neue — browseren syntetiserer den. Brug 700",
        el,
      );

    if (s.fontStyle === "italic")
      add("bør rettes", "kursiv", "kursiv findes ikke i systemet", el);

    if (!/Helvetica Neue|Helvetica|Arial|monospace/i.test(s.fontFamily))
      add("bør rettes", "skrifttype", s.fontFamily.split(",")[0], el);

    const fg = parseRgb(s.color);
    if (fg && fg.a > 0.5) {
      const c = ratio(fg, effectiveBg(el));
      if (c < CONTRAST_MIN)
        add(
          "kritisk",
          "kontrast",
          `${c.toFixed(2)}:1 — kravet er ${CONTRAST_MIN}:1 (${s.color})`,
          el,
        );
    }

    // Kun single-glyph = elementets ENESTE tekst er selve tegnet (evt.
    // med whitespace). En pil midt i en sætning ("Se hvem der trænger
    // til besøg →") er sætnings-typografi, ikke et ikon i forklædning
    // — og teksten skal skrives om, ikke ikon-erstattes. Reglen fanger
    // kun det, den handler om.
    const trimmed = el.textContent.trim();
    if (trimmed.length <= 2 && GLYPHS.test(trimmed))
      add(
        "bør rettes",
        "unicode-tegn som ikon",
        `"${trimmed}" — brug <Icon>`,
        el,
      );
  });

  // ---- 3. ikonstørrelse -------------------------------------------------
  document.querySelectorAll("svg").forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.height < ICON_MIN)
      add(
        "bør rettes",
        "ikonstørrelse",
        `${Math.round(r.width)}×${Math.round(r.height)} px — bunden er ${ICON_MIN}`,
        el,
      );
  });

  // ---- 4. grønne knapper og hårdkodede farver ---------------------------
  document.querySelectorAll('button,[data-slot="button"]').forEach((el) => {
    if (!visible(el)) return;
    const bg = getComputedStyle(el).backgroundColor;
    const raw = getComputedStyle(el).getPropertyValue("background-color");
    const c = parseRgb(bg);
    if (!c || c.a < 0.5) return;
    // grøn = markant mere grønt end rødt og blåt
    if (c.g > c.r + 35 && c.g > c.b + 25)
      add(
        "kritisk",
        "grøn knap",
        `${bg} — grøn betyder "ajour", ikke "tryk her". Brug var(--a)`,
        el,
      );
    if (/oklch/.test(raw))
      add(
        "bør rettes",
        "hårdkodet farve",
        `${raw} — farver skal komme fra tokens`,
        el,
      );
  });

  // ---- 5. vandret overløb ----------------------------------------------
  // Rapportér ikke bare AT siden er for bred, men HVEM der breder den ud.
  // Vi finder alle elementer der er bredere end vinduet, og beholder kun
  // de yderste — dvs. dem hvis nærmeste bredere forfader IKKE selv er
  // for bred. Så peger rapporten på synderen, ikke på hele
  // container-kæden. Uden dette bliver rapporten ubrugelig: 40 rækker,
  // hver med "for bred" — men kun én rod-årsag.
  const vinduesbredde = window.innerWidth;
  if (document.documentElement.scrollWidth > vinduesbredde + 2) {
    const forBrede = [];
    document.querySelectorAll("body, body *").forEach((el) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      // Kun elementer der reelt stikker ud (højre kant > viewport).
      // width alene fanger ikke elementer der er inde men brede;
      // right > vinduesbredde er det symptom auditten reagerer på.
      if (r.right > vinduesbredde + 2) forBrede.push(el);
    });
    // Behold kun "yderste synder": et element hvis nærmeste forfader
    // i sættet enten (a) ikke findes eller (b) selv er ≤ vinduet.
    // Det udelukker container-kæden og peger på selve overloberen.
    const forBredeSet = new Set(forBrede);
    const syndere = forBrede.filter((el) => {
      let p = el.parentElement;
      while (p) {
        if (forBredeSet.has(p)) return false; // en forælder er også for bred → ikke yderste
        p = p.parentElement;
      }
      return true;
    });
    if (!syndere.length) {
      // Fallback: overløb detekteret men ingen enkelt-synder — sig det.
      add(
        "kritisk",
        "vandret overløb",
        `siden er ${document.documentElement.scrollWidth} px bred i et ${vinduesbredde} px vindue — kunne ikke lokalisere elementet`,
        document.body,
      );
    } else {
      // Rapportér op til 3 syndere (holder rapporten læselig hvis flere
      // helt uafhængige elementer alle bryder ud).
      syndere.slice(0, 3).forEach((el) => {
        const r = el.getBoundingClientRect();
        add(
          "kritisk",
          "vandret overløb",
          `${Math.round(r.width)} px bred i et ${vinduesbredde} px vindue`,
          el,
        );
      });
    }
  }

  // ---- 6. tekst der klippes --------------------------------------------
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length || !el.textContent.trim() || !visible(el)) return;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
      add(
        "kosmetisk",
        "tekst klippes",
        `viser ${el.clientWidth} af ${el.scrollWidth} px`,
        el,
      );
  });

  // ---- 7. ikon-knap uden navn ------------------------------------------
  document.querySelectorAll('button,[role="button"]').forEach((el) => {
    if (!visible(el)) return;
    const hasText = el.textContent.trim().length > 0;
    const hasLabel =
      el.getAttribute("aria-label") || el.getAttribute("title");
    if (!hasText && !hasLabel)
      add("bør rettes", "ikon-knap uden navn", "mangler aria-label", el);
  });

  return out;
};
