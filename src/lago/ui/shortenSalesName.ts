/**
 * Brief 54 §3 (17. sep 2026) · sælgernavn i lister = fornavnet alene.
 *
 * LAGO har seks sælgere med hvert sit fornavn (Camilla, Peter, Simon,
 * Rikke, Ole, Jonas) — så fornavnet alene er nok som identifikation.
 * "Peter Æ." ligner en tastefejl; fornavnet gør ikke.
 *
 * Falder to sammen en dag, tilføjes efternavnets forbogstav for netop
 * de to — ikke for alle. Reglen står her, ikke i hver liste.
 *
 * Bruges i kundelisten, aktivitetssiden, ringelisten og widgets.
 * I Stamdata og på kundekortet står det fulde navn — der er plads,
 * og der er det en oplysning, ikke en etiket.
 */

export function shortenSalesName(full: string | null | undefined): string | null {
  if (!full) return null;
  const parts = String(full).trim().split(/\s+/);
  return parts[0] || null;
}
