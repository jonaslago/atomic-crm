// Quick counts on the aktiviteter export before the import script is
// wired: uniqueness of Aftalenr (idempotency key), type distribution,
// how many contain an Aktørnr.
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2];
const wb = XLSX.read(readFileSync(path), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: null,
  raw: false,
});
const dataRows = rows.slice(2);

const COL = { udfoert: 1, dato: 2, type: 5, aftalenr: 10, aktoernr: 11, beskr: 150 };

const seenAftale = new Map();
const typeCounts = new Map();
let withAktoer = 0, withoutAftale = 0, done = 0, withBeskr = 0;
for (const r of dataRows) {
  if (!r) continue;
  const aftale = r[COL.aftalenr];
  const t = r[COL.type];
  const aktoer = r[COL.aktoernr];
  if (aftale) seenAftale.set(aftale, (seenAftale.get(aftale) ?? 0) + 1);
  else withoutAftale++;
  if (aktoer && aktoer !== "0") withAktoer++;
  if (r[COL.udfoert] === "x") done++;
  if (r[COL.beskr] && String(r[COL.beskr]).trim()) withBeskr++;
  const label = t ? String(t).match(/\[(.+?)\]/)?.[1] ?? String(t) : "(none)";
  typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
}
const duplicates = [...seenAftale.entries()].filter(([, c]) => c > 1);
console.log("Total rows:", dataRows.length);
console.log("With Aktørnr:", withAktoer);
console.log("With Aftalenr:", seenAftale.size + duplicates.reduce((s,[,c]) => s+c-1, 0));
console.log("Without Aftalenr:", withoutAftale);
console.log("Distinct Aftalenr:", seenAftale.size);
console.log("Duplicate Aftalenr count:", duplicates.length);
console.log("With Beskrivelse:", withBeskr);
console.log("Done ('x'):", done);
console.log("Type distribution:", Object.fromEntries(typeCounts));
