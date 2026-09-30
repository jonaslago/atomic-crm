/**
 * Brief 58 §4a (17. sep 2026) · canonical labels for VISMA-ejede felter.
 *
 * Én kilde. Bruges af Stamdata-rækkerne på kundekortet OG af
 * ForslagRettelserWidget på kontorets forside, så et forslag der siger
 * "Telefon" på skærmen kommer fra samme streng som Stamdata's
 * "Telefon"-række. To lister med feltnavne driver fra hinanden.
 *
 * Feltnøglerne matcher `proposeFelt` som skrives i change_suggestions_lago
 * (companies.address, companies.phone_number, companies_lago.betaling …).
 */

const LABELS: Record<string, string> = {
  address: "Adresse",
  phone_number: "Telefon",
  faktura_email: "Faktura-e-mail",
  tax_identifier: "CVR-nummer",
  distrikt: "Distrikt",
  visma_sales_code: "Ansvarlig sælger",
  betaling: "Betalingsbetingelser",
  sector: "Branche",
  branche_kode: "Branche",
  segment: "Segment",
  opening_hours: "Åbningstider",
  debitorinfo: "Debitorinfo",
};

const PHONE_FIELDS = new Set(["phone_number"]);

export function fieldLabel(felt: string): string {
  return LABELS[felt] ?? felt;
}

/** True for felter hvor værdien er et telefonnummer og bør formateres
 *  med formatPhonePairs i visningen. */
export function isPhoneField(felt: string): boolean {
  return PHONE_FIELDS.has(felt);
}

/** Formatér en felt-værdi til visning. Telefonnumre par-formateres;
 *  resten trimmes. Brugt af ForslagRettelserWidget så et forslag
 *  viser 31 71 61 61 i stedet for 31716161. */
export function formatFieldValue(
  felt: string,
  value: string | null | undefined,
): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (isPhoneField(felt)) {
    // Import gennem funktions-argument for at undgå cyklisk import.
    // Kaldes fra widget'en der selv har adgang til formatPhonePairs.
    return formatPhoneLocal(raw);
  }
  return raw;
}

// Duplikat af formatPhonePairs-logikken for at holde fieldLabels.ts
// import-fri. Reglen er så enkel at duplikering er billigere end at
// binde en UI-utility ind i en label-modul.
function formatPhoneLocal(input: string): string {
  const plus = input.startsWith("+") ? "+" : "";
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return input;
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
