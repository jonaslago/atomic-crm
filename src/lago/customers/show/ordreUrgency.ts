/**
 * §99 (2. okt 2026): urgency color for an open order.
 *
 * Three bearers, not one:
 *   Bucket (why it waits) — from §32a cascade
 *   Color (how urgent)    — this function
 *   Icon (office status)  — from ordre_opfoelgning_lago
 *
 * Color rules:
 *   red:     klar uden aftale (always, from day 1)
 *            · aftalt dato overskredet
 *            · opfølgningsfrist overskredet
 *   yellow:  skal sendes i dag eller i morgen
 *            · sendt til sælger, frist not yet reached
 *   neutral: venter på noget we don't control
 *            (restordre · MAV · reservation · EP)
 *   green:   aftalt dato i fremtiden · bekræftet i VISMA
 */

export type UrgencyColor = "red" | "yellow" | "neutral" | "green";

export interface UrgencyInput {
  /** From the bucket cascade */
  bucket: "uafklaret" | "afklaret" | "restordre" | "reservation" | "en_primeur";
  /** Ønsket leveringsdato on the order (null = no date) */
  oensketLevering: string | null;
  /** Active follow-up status from ordre_opfoelgning_lago */
  opfoelgning: {
    handling: "sendt_til_saelger" | "afventer_visma" | "udskudt";
    frist: string | null;
    status: "aktiv" | "bekraeftet" | "udloebet" | "annulleret";
  } | null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeUrgency(input: UrgencyInput): UrgencyColor {
  const today = todayIso();
  const tomorrow = tomorrowIso();

  // Active follow-up with future deadline → suppressed (neutral/yellow)
  if (input.opfoelgning?.status === "aktiv" && input.opfoelgning.frist) {
    if (input.opfoelgning.frist >= today) {
      // Deadline not yet reached
      if (input.opfoelgning.handling === "sendt_til_saelger") return "yellow";
      return "neutral"; // udskudt or afventer_visma
    }
    // Deadline passed → falls through to normal urgency (back to red)
  }

  // Bekræftet in VISMA → green
  if (input.opfoelgning?.status === "bekraeftet") return "green";

  // Bucket-based base color
  switch (input.bucket) {
    case "uafklaret":
      // Klar uden aftale — red from day 1, always
      return "red";

    case "afklaret": {
      // Has a date or MAV
      if (!input.oensketLevering) return "neutral"; // MAV without date
      if (input.oensketLevering < today) return "red"; // date passed
      if (input.oensketLevering <= tomorrow) return "yellow"; // today/tomorrow
      return "green"; // future date
    }

    case "restordre":
    case "reservation":
    case "en_primeur":
      return "neutral";

    default:
      return "neutral";
  }
}

/** Sort key: red=0, yellow=1, neutral=2, green=3 */
export function urgencySortKey(color: UrgencyColor): number {
  switch (color) {
    case "red":
      return 0;
    case "yellow":
      return 1;
    case "neutral":
      return 2;
    case "green":
      return 3;
  }
}
