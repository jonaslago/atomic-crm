// Regenerér hele appIcon-saettet + header-logo fra kilde-PNG.
// Kilde = LAGO's drueklase paa transparent baggrund (510x510), som
// Jonas har uploadet til configuration-raekken i basen.
//
// Regler:
//   - App-ikoner (hjemmeskaerm): SOLID HVID baggrund. iOS/Android
//     erstatter transparens med sort — det ville give sort firkant om
//     druen. Padding = 10% af siden saa mærket ikke rører kanten.
//   - Header-logo (i tokens.css / configuration): TRANSPARENT bevares.
//   - Maskable-varianter: SOLID HVID baggrund + større safe-zone
//     (Android klipper op til 20% af kanten paa runde/squircle-icons).

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");
const SRC = resolve(REPO, "scripts/lago/data/lago-drueklase-source.png");
const APP_ICON_DIR = resolve(REPO, "public/appIcon");
const LOGO_DIR = resolve(REPO, "public/logos");

// Standard-ikoner (solid hvid baggrund, ~10% padding).
const STANDARD_SIZES = [
  16, 20, 29, 32, 40, 50, 57, 58, 60, 64, 72, 76, 80, 87, 100, 114, 120, 128,
  136, 144, 152, 167, 180, 192, 256, 512, 1024,
];

// Maskable-varianter (solid hvid baggrund, ~20% padding for Androids
// safe-zone). Filnavne matcher det, manifest.json allerede peger paa.
const MASKABLE_SIZES = [48, 72, 96, 128, 192, 384, 512, 1024];

async function makeIcon(sourceBuf, size, padding, out) {
  const inner = Math.round(size * (1 - padding * 2));
  const resized = await sharp(sourceBuf)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(out);
}

async function main() {
  const src = readFileSync(SRC);
  console.log(`Kilde: ${SRC} (${src.length} bytes)`);

  console.log("\n--- Standard-ikoner (10% padding, hvid baggrund) ---");
  for (const s of STANDARD_SIZES) {
    const out = resolve(APP_ICON_DIR, `${s}.png`);
    await makeIcon(src, s, 0.1, out);
    console.log(`  ${s}.png`);
  }

  console.log("\n--- Maskable-varianter (20% padding, hvid baggrund) ---");
  for (const s of MASKABLE_SIZES) {
    const out = resolve(APP_ICON_DIR, `maskable_icon_x${s}.png`);
    await makeIcon(src, s, 0.2, out);
    console.log(`  maskable_icon_x${s}.png`);
  }
  // Ogsaa den navnloese "maskable_icon.png" (1024) som manifest peger paa.
  await makeIcon(src, 1024, 0.2, resolve(APP_ICON_DIR, "maskable_icon.png"));
  console.log("  maskable_icon.png");

  console.log("\n--- Header-logo (transparent baggrund, 510) ---");
  // Header viser <img className="h-6"> = 24 px hoej. En 510x510-PNG paa
  // 24 px giver skarpe kanter uden opsampling. Vi bevarer 510x510 saa
  // hi-DPI-skaerme (2x-3x) har nok pixels.
  const headerOut = resolve(LOGO_DIR, "lago_drueklase.png");
  await sharp(src).png().toFile(headerOut);
  console.log(`  logos/lago_drueklase.png`);

  console.log("\nFaerdig.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
