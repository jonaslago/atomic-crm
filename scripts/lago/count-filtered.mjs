// Sanity check: how many rows pass the LAGO import filters
// (erhverv/privat = "Erhverv", distrikt not in Intern/HQ/Eksport)?
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2];
const wb = XLSX.read(readFileSync(path), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: null,
  raw: false,
});

const DISTRIKT_COL = 2;
const ERHVERV_COL = 76;
const KUNDENR_COL = 0;

function labelOf(val) {
  if (typeof val !== "string") return null;
  const m = val.match(/\[(.+?)\]/);
  return m ? m[1] : val;
}

const EXCLUDED = new Set(["Intern", "HQ", "Eksport"]);
let kept = 0;
const distCounts = new Map();
const erhvervCounts = new Map();

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const kundenr = r[KUNDENR_COL];
  if (!kundenr) continue;
  const distrikt = labelOf(r[DISTRIKT_COL]);
  const erhverv = labelOf(r[ERHVERV_COL]);
  distCounts.set(distrikt, (distCounts.get(distrikt) ?? 0) + 1);
  erhvervCounts.set(erhverv, (erhvervCounts.get(erhverv) ?? 0) + 1);
  if (erhverv !== "Erhverv") continue;
  if (distrikt && EXCLUDED.has(distrikt)) continue;
  kept++;
}

console.log("Total data rows:", rows.length - 2);
console.log("Kept after filters:", kept);
console.log("Distrikt distribution:", Object.fromEntries(distCounts));
console.log("erhverv/privat distribution:", Object.fromEntries(erhvervCounts));
