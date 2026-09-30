// Brief 43 (16. sep 2026, delvis): humaniser lang varighed i lister.
// "1095 dage over" fortæller ikke sælgeren noget — det er 3 år, det
// er pointen. Reglen:
//   0        → "i dag"
//   1        → "1 dag over"
//   2–29     → "N dage over"
//   30–364   → "N md. over"  (afrundet nedad)
//   365+     → "N år over"    (afrundet nedad, minimum 1)
//
// Vælger nedadrunding for at underdrive frem for at overdrive — 400
// dage er "1 år over", ikke "2 år over". 730 dage (præcis 2 år) er
// "2 år over". Sammenlignelighed slår præcision når læseren scanner
// en liste.

export function humanOverdue(days: number | null | undefined): string {
  const n = Math.max(0, Math.trunc(days ?? 0));
  if (n === 0) return "i dag";
  if (n === 1) return "1 dag over";
  if (n < 30) return `${n} dage over`;
  if (n < 365) {
    const months = Math.floor(n / 30);
    return `${months} md. over`;
  }
  const years = Math.floor(n / 365);
  return `${years} år over`;
}

// Brief 45 §4 (16. sep 2026): tabelkolonnen "Sidste besøg" siger selv
// hvad tallet er. Dagtal ≤ 30 skrives kompakt ("14 dage"); over 30
// humaniseres til md./år så scannerens øje ikke skal tælle 400 dage.
// Kaldes uden "over"-suffix — det er ikke overskridelse men rå afstand.
export function humanDaysSince(days: number | null | undefined): string {
  if (days == null) return "aldrig";
  const n = Math.max(0, Math.trunc(days));
  if (n === 0) return "i dag";
  if (n === 1) return "1 dag";
  if (n < 30) return `${n} dage`;
  if (n < 365) {
    const months = Math.floor(n / 30);
    return `${months} md.`;
  }
  const years = Math.floor(n / 365);
  return `${years} år`;
}
