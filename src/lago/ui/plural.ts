/**
 * Brief 90 opfølgning (29. sep 2026) · dansk ental/flertal-hjælper.
 *
 * "1 aktiviteter" er en stump programmør-fejl, der siger til læseren:
 * "vi har ikke fanget dit tal". Danske substantiver bøjer sig hyppigt
 * mellem ental og flertal — aktivitet/aktiviteter, kunde/kunder, ordre/
 * ordrer, opgave/opgaver.
 *
 * Brug: `plural(1, "aktivitet", "aktiviteter")` → "1 aktivitet".
 *        `plural(3, "aktivitet", "aktiviteter")` → "3 aktiviteter".
 *        `pluralWord(1, "kunde", "kunder")` → "kunde" (uden tal).
 */

export function plural(
  n: number,
  ental: string,
  flertal: string,
): string {
  return `${n} ${n === 1 ? ental : flertal}`;
}

export function pluralWord(
  n: number,
  ental: string,
  flertal: string,
): string {
  return n === 1 ? ental : flertal;
}
