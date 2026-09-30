// One-shot inspection: dump the row-2 headers and a few sample rows from
// the LAGO VISMA customer extract so we can confirm the column names
// before wiring the import.
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/lago/inspect-xls.mjs <xls-path> [sample-count]");
  process.exit(1);
}
const sampleCount = Number(process.argv[3] ?? 3);

const wb = XLSX.read(readFileSync(path), { type: "buffer" });
const sheetName = wb.SheetNames[0];
console.log("Sheet:", sheetName);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
  header: 1,
  defval: null,
  raw: false,
});

console.log("Total rows:", rows.length);
console.log("Row 0 (should be junk 'Aktør'):", (rows[0] ?? []).slice(0, 6));
const headers = rows[1] ?? [];
console.log("Row 1 headers count:", headers.length);
console.log("Headers:");
headers.forEach((h, i) => {
  if (h != null && h !== "") console.log(`  [${i}] ${h}`);
});

console.log("\nSample rows:");
for (let i = 2; i < Math.min(2 + sampleCount, rows.length); i++) {
  console.log(`-- Row ${i} --`);
  headers.forEach((h, col) => {
    const v = rows[i]?.[col];
    if (v != null && v !== "") console.log(`  ${h}: ${JSON.stringify(v)}`);
  });
}
