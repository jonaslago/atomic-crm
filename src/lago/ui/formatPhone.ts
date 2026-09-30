/**
 * Brief 51 §2 (17. sep 2026) · dansk telefonnummer i par.
 *
 * "21408899" → "21 40 88 99". "Otte cifre i træk kan man ikke læse i
 * en bildør." Bruges alle steder hvor et tal vises som tekst: under
 * kontaktpersoner, i preview-panelet, i Ring-knappen, i Stamdata.
 *
 * Reglen er så simpel som muligt: fjern alt der ikke er cifre, sæt
 * mellemrum efter hvert par. Landekode "+45" bevares hvis det er der.
 * Ikke-standard tal (mobilnumre der starter med anden præfiks, korte
 * numre) håndteres af samme regel — det ser stadig pænere ud end
 * "21408899".
 */

/**
 * Brief 90 opfølgning (29. sep 2026): et telefonnummer der har færre
 * cifre end 8 er ikke et telefonnummer. Ring-knappen må ikke tilbyde
 * `tel:` på det — sælgeren vil tro han har prøvet.
 *
 * Otte cifre er dansk standard. Med +xx-prefix accepteres 8 nationale
 * cifre + landekode (dvs. 10 i alt). Målt 29. sep: 1041 kunder har
 * præcis 8 cifre, 22 har 1-7 cifre (heraf 2 synlige aktive), 68 har
 * intet nummer. Grænseværdien 8 fanger de kritiske; +xx-tolerancen
 * lader udenlandske numre passere.
 */
export function isDialablePhone(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return false;
  const nationalDigits = input.trim().startsWith("+")
    ? digits.slice(2)
    : digits;
  return nationalDigits.length >= 8;
}

export function formatPhonePairs(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Bevar +xx-præfiks hvis det er der.
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return trimmed;
  // Danske numre er 8 cifre. Med +45 bliver det 10: læg mellemrum
  // efter landekoden så første par kan skimtes.
  let rest = digits;
  let prefix = plus;
  if (plus && digits.length >= 10) {
    prefix = `+${digits.slice(0, 2)} `;
    rest = digits.slice(2);
  }
  const pairs: string[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    pairs.push(rest.slice(i, i + 2));
  }
  return `${prefix}${pairs.join(" ")}`;
}
