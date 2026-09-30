/**
 * Debug: kan vi se AI-3-panelet i Registrer-modalen på live-deploy?
 * Bruger audit-sessionen (Jonas' login), åbner første kunde,
 * klikker Registrér, tjekker at "AI-forslag" er i DOM'en.
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const SESSION = "/Users/jonasarild/Documents/Claude/Projects/LAGO CRM/atomic-crm/lago/ux-audit/.session.json";
if (!existsSync(SESSION)) {
  console.error("no session");
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chromium" });
const VP = process.argv[2] === "ipad"
  ? { width: 834, height: 1112 }
  : process.argv[2] === "iphone"
    ? { width: 375, height: 812 }
    : { width: 1440, height: 900 };
console.log(`Viewport: ${VP.width}x${VP.height}`);
const ctx = await browser.newContext({
  storageState: SESSION,
  viewport: VP,
  locale: "da-DK",
});
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`CONSOLE.ERROR: ${m.text()}`);
});

const t = Date.now();
await page.goto(`https://crm.lago.dk/?t=${t}#/companies/1/show`, {
  waitUntil: "networkidle",
  timeout: 20000,
});
await page.waitForTimeout(2000);

// Snap første synlige Registrer-knap
const registerBtn = page
  .getByRole("button", { name: /^Registr[eé]r$/i })
  .first();
const btnCount = await page
  .getByRole("button", { name: /^Registr[eé]r$/i })
  .count();
console.log(`Registrer-knapper på kundeside: ${btnCount}`);

if (btnCount === 0) {
  console.log("Ingen Registrér-knap fundet på kundesiden.");
  await page.screenshot({ path: "/tmp/debug-ai3-nokundeside.png" });
  await browser.close();
  process.exit(1);
}

await registerBtn.click();
await page.waitForTimeout(1500);

let dialogVisible = await page.locator('[role="dialog"]').isVisible();
console.log(`Dialog efter 1. klik: ${dialogVisible}`);

// Portrait-fallback viser RegistrationRailContent inline i stedet for
// dialog. Så vi må klikke igen på den nu-synlige RegistrerButton.
if (!dialogVisible) {
  const rebtnCount = await page
    .getByRole("button", { name: /^Registr[eé]r$/i })
    .count();
  console.log(`Registrer-knapper efter 1. klik: ${rebtnCount}`);
  if (rebtnCount > 0) {
    // klik sidste (den nyeste dukket op)
    await page
      .getByRole("button", { name: /^Registr[eé]r$/i })
      .last()
      .click();
    await page.waitForTimeout(1500);
    dialogVisible = await page.locator('[role="dialog"]').isVisible();
    console.log(`Dialog efter 2. klik: ${dialogVisible}`);
  }
}

// Er vi på Besøg-fanen?
const besoegTab = await page.getByRole("tab", { name: /Bes.g/i }).first();
if (await besoegTab.isVisible()) {
  const selected = await besoegTab.getAttribute("data-state");
  console.log(`Besøg-fane data-state: ${selected}`);
  if (selected !== "active") await besoegTab.click();
  await page.waitForTimeout(500);
}

// Tjek om "AI-forslag"-panelet er i DOM
const aiPanelCount = await page.getByText("AI-forslag").count();
const knapCount = await page
  .getByRole("button", { name: /Foresl. opf.lgninger/i })
  .count();
console.log(`AI-forslag mentions: ${aiPanelCount}`);
console.log(`Foreslå opfølgninger-knapper: ${knapCount}`);

// Skriv i note-feltet så vi ser om knap-state opdaterer
const note = page.locator('#besoeg-note');
if (await note.isVisible()) {
  await note.fill(
    "Peter vil have prøver på de to nye rosé-vine sendt inden næste uge.",
  );
  await page.waitForTimeout(300);
  const btn = page
    .getByRole("button", { name: /Foresl. opf.lgninger/i })
    .first();
  if (await btn.isVisible()) {
    const disabled = await btn.isDisabled();
    console.log(`Foreslå-knap synlig, disabled: ${disabled}`);
  }
}

await page.screenshot({ path: "/tmp/debug-ai3-modal.png", fullPage: true });
console.log("Screenshot: /tmp/debug-ai3-modal.png");

if (errors.length) {
  console.log("\nERRORS SEEN:");
  errors.forEach((e) => console.log("  " + e));
}

await browser.close();
