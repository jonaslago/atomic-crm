/**
 * LAGO · TouchTarget (brief 47 §2a, 16. sep 2026)
 *
 * Ikke en komponent — en regel. 255 forekomster af `min-h-[44px]` i 14
 * af Stitchs skærme; 30 forekomster af `min-h-[48px]` i 8. Det er den
 * mest gennemgående beslutning i hele hans arbejde.
 *
 * Reglen: **44 px er gulvet. 48 px på en hovedhandling.**
 *
 * Vi bruger `--tap` (44 px), som allerede findes i tokens.css. De to
 * konstanter herunder holder Tailwind-klasserne ét sted, så et rettet
 * gulv aldrig ligger spredt.
 */

/** 44 px trykmål — sælgerens tommelfinger i modlys.
 *  Bruges på alle interaktive elementer i standard-flow. */
export const TAP_MIN = "min-h-11";

/** 48 px trykmål — kun på blokkens ÉNE primær-handling (fx "Registrér
 *  besøg", "Gem"). Aldrig på sekundære eller ikonknapper. */
export const TAP_PRIMARY = "min-h-12";
