/**
 * LAGO CRM · designsystem-audit
 *
 * Går alle ruter igennem i tre skærmstørrelser og rapporterer hvor fladen
 * bryder med design/LAGO_Design_System_implementering.md.
 *
 * Kør:
 *   node lago/ux-audit/login.mjs            (én gang — du logger ind i vinduet)
 *   node lago/ux-audit/audit.mjs            (mod crm.lago.dk)
 *   node lago/ux-audit/audit.mjs http://localhost:5173
 *
 * Rapporten lander i lago/ux-audit/rapport.md
 * Afslutter med kode 1 hvis der findes kritiske fund — så den kan bruges
 * som port i en byggeproces senere.
 */
import { chromium } from "playwright";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditInPage } from "./rules.mjs";

const HER = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(HER, ".session.json"); // git-ignoreret
const BASE = process.argv[2] ?? "https://crm.lago.dk";

const RUTER = [
  ["Hjem", "#/"],
  ["Dagens", "#/felt/dagens"],
  ["Kort", "#/felt/kort"],
  ["Søg", "#/felt/soeg"],
  ["Kunder", "#/companies"],
  ["Kontakter", "#/contacts"],
  ["Aftaler", "#/deals"],
  ["Salgsudvikling", "#/salgsudvikling"],
  ["Indstillinger", "#/indstillinger"],
];

const STØRRELSER = [
  ["iPhone", 375, 812],
  ["iPad", 834, 1112],
  ["Laptop", 1440, 900],
];

const RANG = { kritisk: 0, "bør rettes": 1, kosmetisk: 2 };
const MÆRKE = { kritisk: "🔴", "bør rettes": "🟡", kosmetisk: "⚪️" };

if (!existsSync(SESSION)) {
  console.error(
    `Ingen session fundet.\nKør først:  node ${path.relative(process.cwd(), path.join(HER, "login.mjs"))}`,
  );
  process.exit(2);
}

// channel: "chromium" bruger den fulde chromium der er installeret via
// `npx playwright install chromium` (som e2e-suiten allerede kræver).
// Playwright's default siden 1.55 er den lette chrome-headless-shell,
// men den er ikke nødvendigvis installeret — genbrug den fulde build.
const browser = await chromium.launch({ channel: "chromium" });
const fund = [];

// Cache-buster: unik pr. audit-kørsel. Sat på hver page.goto som
// query-param FØR hash-fragmentet (BASE + "/?t=..." + "#/rute"), så
// CDN'en (GitHub Pages Fastly) tvinges til at forwarde til origin —
// tidligere brugte vi extraHTTPHeaders med Cache-Control: no-cache,
// men CDN'en respekterer det ikke og leverer stadig fra kant.
// Hash-fragmentet påvirker ikke request-URL'en (HashRouter er
// client-side), så SPA-ruten virker uændret.
const CACHE_BUSTER = Date.now();

for (const [enhed, width, height] of STØRRELSER) {
  const ctx = await browser.newContext({
    storageState: SESSION,
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: "da-DK",
  });
  const page = await ctx.newPage();

  for (const [navn, rute] of RUTER) {
    try {
      await page.goto(`${BASE}/?t=${CACHE_BUSTER}${rute}`, { waitUntil: "networkidle", timeout: 20000 });
      // giv React-forespørgsler et øjeblik til at falde på plads
      await page.waitForTimeout(1200);
      const r = await page.evaluate(auditInPage);
      r.forEach((v) => fund.push({ ...v, enhed, skærm: navn }));
      process.stdout.write(`  ${enhed.padEnd(7)} ${navn.padEnd(15)} ${r.length} fund\n`);
    } catch (e) {
      fund.push({
        severity: "kritisk",
        rule: "siden kunne ikke indlæses",
        detail: String(e.message).split("\n")[0],
        where: "",
        enhed,
        skærm: navn,
      });
      process.stdout.write(`  ${enhed.padEnd(7)} ${navn.padEnd(15)} FEJL\n`);
    }
  }
  await ctx.close();
}
await browser.close();

// ---- rapport ------------------------------------------------------------
// Samme regel på samme element (rule + where) = ét fund, uanset hvor mange
// viewports det optræder på. detail (fx "36 px") indeholder den målte
// værdi — den varierer pr. viewport og må IKKE være del af nøglen,
// ellers duplikerer samme problem 3× og top-tallet bliver misvisende.
// Værdierne samles i posten som "36 px (iPhone) · 38 px (iPad)".
const nøgle = (f) => `${f.rule}|${f.where}`;
const samlet = new Map();
for (const f of fund) {
  const k = nøgle(f);
  if (!samlet.has(k)) {
    samlet.set(k, {
      severity: f.severity,
      rule: f.rule,
      where: f.where,
      // Bevar strengest severity på tværs af viewports
      // (fx en trykmåls-fejl der er kritisk på iPhone og kosmetisk på Laptop
      //  fremstilles som kritisk).
      _detailPerViewport: [],
      steder: new Set(),
    });
  }
  const post = samlet.get(k);
  post._detailPerViewport.push({ detail: f.detail, viewport: f.enhed });
  post.steder.add(`${f.skærm}/${f.enhed}`);
  if (RANG[f.severity] < RANG[post.severity]) post.severity = f.severity;
}
// Byg samlet detail-streng pr. post: unikke detail-værdier, viewport i parentes.
for (const post of samlet.values()) {
  const perDetail = new Map();
  for (const d of post._detailPerViewport) {
    if (!perDetail.has(d.detail)) perDetail.set(d.detail, new Set());
    perDetail.get(d.detail).add(d.viewport);
  }
  post.detail =
    perDetail.size === 1
      ? [...perDetail.keys()][0]
      : [...perDetail.entries()]
          .map(([det, vps]) => `${det} (${[...vps].join(", ")})`)
          .join(" · ");
  delete post._detailPerViewport;
}
const liste = [...samlet.values()].sort(
  (a, b) => RANG[a.severity] - RANG[b.severity] || a.rule.localeCompare(b.rule),
);

const antal = (s) => liste.filter((f) => f.severity === s).length;
const nu = new Date().toLocaleString("da-DK");

let md = `# Designsystem-audit — ${BASE}

Kørt ${nu} · ${RUTER.length} ruter × ${STØRRELSER.length} størrelser

| | Antal |
| --- | ---: |
| 🔴 Kritisk | ${antal("kritisk")} |
| 🟡 Bør rettes | ${antal("bør rettes")} |
| ⚪️ Kosmetisk | ${antal("kosmetisk")} |

Reglerne står i \`rules.mjs\` og er hentet fra
\`design/LAGO_Design_System_implementering.md\`. Ændres en regel dér, skal den
ændres begge steder.

---

`;

let sidsteRegel = null;
for (const f of liste) {
  if (f.rule !== sidsteRegel) {
    md += `\n## ${MÆRKE[f.severity]} ${f.rule}\n\n`;
    sidsteRegel = f.rule;
  }
  const steder = [...f.steder].sort();
  const hvor =
    steder.length > 6 ? `${steder.length} steder` : steder.join(" · ");
  md += `- **${f.detail}**\n  ${f.where}\n  *${hvor}*\n`;
}

if (!liste.length) md += "\nIngen fund. Fladen overholder designsystemet.\n";

writeFileSync(path.join(HER, "rapport.md"), md);
console.log(
  `\n🔴 ${antal("kritisk")}  🟡 ${antal("bør rettes")}  ⚪️ ${antal("kosmetisk")}\n→ lago/ux-audit/rapport.md`,
);
process.exit(antal("kritisk") > 0 ? 1 : 0);
