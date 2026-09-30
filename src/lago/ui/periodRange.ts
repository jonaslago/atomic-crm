/**
 * §12 (29. sep 2026) · fælles periodeberegning.
 *
 * Tre begreber på skærmen var defineret hvert sit sted: aktivitetssidens
 * "Denne uge" (korrekt ISO-uge, mandag-søndag), widget'ens "de næste 7
 * dage" (rolling fra i dag), og en tidligere kladde jeg forvekslede med
 * ugen. Ét begreb, én implementation.
 *
 * ISO-uge: mandag som første dag. En tirsdag 29. sep giver uge = 28.
 * sep til 4. okt.
 */

function normalizeDate(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Mandag i den ISO-uge datoen falder i. */
export function startOfIsoWeek(reference: Date = new Date()): Date {
  const d = normalizeDate(reference);
  const day = d.getDay(); // 0=søn, 1=man, ..., 6=lør
  const diff = (day + 6) % 7; // 0=man, 1=tir, ..., 6=søn
  d.setDate(d.getDate() - diff);
  return d;
}

/** Søndag i den ISO-uge datoen falder i. */
export function endOfIsoWeek(reference: Date = new Date()): Date {
  const d = startOfIsoWeek(reference);
  d.setDate(d.getDate() + 6);
  return d;
}

export function startOfMonth(reference: Date = new Date()): Date {
  const d = normalizeDate(reference);
  d.setDate(1);
  return d;
}

export function endOfMonth(reference: Date = new Date()): Date {
  const d = normalizeDate(reference);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

export function todayNormalized(): Date {
  return normalizeDate(new Date());
}

/** ISO-dato-streng (YYYY-MM-DD) i lokal tid, ikke UTC. `toISOString()`
 *  konverterer til UTC og kan flytte datoen med en dag i sen aften. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Denne uges vindue, ISO — mandag til søndag inkl. */
export function thisIsoWeek(reference: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  return {
    fromIso: toIsoDate(startOfIsoWeek(reference)),
    toIso: toIsoDate(endOfIsoWeek(reference)),
  };
}
