import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: process.env.NODE_ENV !== "CI",
      filename: "./dist/stats.html",
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      // Brief 57 §0b (17. sep 2026): "prompt" i stedet for "autoUpdate" —
      // vi styrer selv skipWaiting via useRegisterSW-hook'en så
      // brugeren får en "Ny version klar"-stribe frem for en tavs
      // reload midt i en indtastning. En autoUpdate uden signal er
      // værre end en cachet gammel bundle.
      registerType: "prompt",
      workbox: {
        // §100: push handler imported into the service worker
        importScripts: ["push-handler.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // Aggressiv opdatering: en ny service-worker skal aktiveres
        // med det samme og overtage åbne tabs uden at kræve close-all.
        // Ellers hænger sælgeren fast i et gammelt, evt. crashende
        // bundle.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Network-first på navigations-requests: index.html hentes
        // altid friskt (falder tilbage til cache offline). Det er den
        // eneste fil der peger på den nye bundle-hash — precache af
        // en gammel index.html er det klassiske stale-bundle-tag.
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "lago-navigations",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
            },
          },
          // Brief 66 §3 (18. sep 2026): CacheFirst paa basemap-fliser.
          // En vej flytter sig ikke. Uden denne regel henter kortet
          // hele Danmark forfra ved hver sideaabning (18 s paa mobilnet).
          // Reglen daekker BEGGE providere fra dag et: CARTO nu og
          // Dataforsyningens Skaermkort_daempet efter §6-skiftet — saa
          // vi ikke skal roere reglen igen. 30 dages udloeb, 400 fliser
          // (nok til at scrolle det meste af Danmark ved zoom 8-12).
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".basemaps.cartocdn.com") ||
              url.hostname === "api.dataforsyningen.dk",
            handler: "CacheFirst",
            options: {
              cacheName: "lago-basemap-tiles",
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  define:
    process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(
            process.env.VITE_IS_DEMO,
          ),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SB_PUBLISHABLE_KEY,
          ),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
            process.env.VITE_INBOUND_EMAIL,
          ),
          "import.meta.env.VITE_ATTACHMENTS_BUCKET": JSON.stringify(
            process.env.VITE_ATTACHMENTS_BUCKET,
          ),
        }
      : undefined,
  base: "./",
  esbuild: {
    // NB: må IKKE være true. MapLibre spawner sin render-worker fra
    // hovedbundelen; keepNames injicerer en `__name`-helper i outer
    // scope som workeren ikke arver. Resultat: worker crasher med
    // "__name is not defined" → GeoJSON-pins bliver aldrig
    // processeret (raster-fliser rendered på main-thread, så kortet
    // *ser* rigtigt ud men er tomt). Se brief 12-diagnosen.
    keepNames: false,
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
