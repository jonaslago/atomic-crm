/**
 * Gemmer en login-session, så auditten kan køre uden hjælp bagefter.
 *
 * Der åbnes et rigtigt browservindue. Du logger ind selv — hverken scriptet
 * eller nogen anden ser din adgangskode. Når du er inde, trykker du Enter i
 * terminalen, og sessionen gemmes i .session.json, som er git-ignoreret.
 *
 * Sessionen holder, indtil den udløber. Så kør dette igen.
 *
 *   node lago/ux-audit/login.mjs
 *   node lago/ux-audit/login.mjs http://localhost:5173
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HER = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "https://crm.lago.dk";

// Se kommentar i audit.mjs: brug fuld chromium (installeret via
// `npx playwright install chromium` for e2e), ikke chrome-headless-shell.
const browser = await chromium.launch({ channel: "chromium", headless: false });
const ctx = await browser.newContext({ locale: "da-DK" });
const page = await ctx.newPage();
await page.goto(BASE);

console.log(`\nLog ind i vinduet. Tryk derefter Enter her.\n`);
await new Promise((r) => process.stdin.once("data", r));

await ctx.storageState({ path: path.join(HER, ".session.json") });
await browser.close();
console.log("Session gemt. Kør nu:  node lago/ux-audit/audit.mjs\n");
process.exit(0);
