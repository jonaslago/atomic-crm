import { useQuery } from "@tanstack/react-query";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertCircle, Compass, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGetIdentity, useTranslate } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { humanOverdue } from "@/lago/ui/humanDuration";

import { CustomerCard } from "@/lago/kort/CustomerCard";
import type { FeltCustomer } from "@/lago/kort/customerData";
import {
  computeFeltFilterCounts,
  defaultFeltFilters,
  passesFeltFilters,
  type FeltFilters,
} from "@/lago/kort/filters";
import { MobileFilterButton } from "@/lago/kort/MobileFilterButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";

import { fetchKortCustomers } from "./dataAccess";
import { KortLensPanel } from "./KortLensPanel";
import { getAppVersion } from "@/lago/layout/useAppVersion";

// ---------------------------------------------------------------------
// Kortfliser
//
// Dataforsyningens gratis Skærmkort-tjeneste er den langsigtede løsning
// (dansk, officielt) men kræver en gratis token registreret på
// https://dataforsyningen.dk/user/register. Når vi har token'et
// afsløres den via `VITE_DATAFORSYNINGEN_TOKEN` og vi bruger deres
// WMTS-endpoint. Uden token falder vi tilbage til CARTO's Positron —
// en pålidelig, gratis, tokenfri basemap-tjeneste bygget på OSM-data
// der virker fra github.io (uens `tile.openstreetmap.org`, som
// eksplicit rate-limiter apps og ofte tjener blank fra github.io).
// ---------------------------------------------------------------------

const DATAFORSYNINGEN_TOKEN = (import.meta.env.VITE_DATAFORSYNINGEN_TOKEN ?? "")
  .toString()
  .trim();

// CARTO Basemaps-nøgle er domænelåst hos CARTO til crm.lago.dk.
// Uden nøgle får man vandmærke; med nøgle er fliserne rene.
const CARTO_KEY = "cb1_2ptm_1_68b4d4e0b874ed1105c24055";
const CARTO_TILES = [
  `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
  `https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
  `https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
  `https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
];

// Dataforsyningens Skærmkort_dæmpet WMTS bygges kun når token er sat.
const DATAFORSYNINGEN_TILES = DATAFORSYNINGEN_TOKEN
  ? [
      `https://api.dataforsyningen.dk/topo_skaermkort_daempet_DAF?service=WMTS&request=GetTile&version=1.0.0&layer=topo_skaermkort_daempet&tilematrixset=View1&style=default&format=image/jpeg&tilematrix={z}&tilecol={x}&tilerow={y}&token=${DATAFORSYNINGEN_TOKEN}`,
    ]
  : null;

const TILE_URLS = DATAFORSYNINGEN_TILES ?? CARTO_TILES;
const TILE_ATTRIBUTION = DATAFORSYNINGEN_TILES
  ? "© Styrelsen for Dataforsyning og Infrastruktur · geokodning: Dataforsyningen (DAWA)"
  : "© <a href=\"https://carto.com/attributions\">CARTO</a> · © OpenStreetMap-bidragydere · geokodning: Dataforsyningen (DAWA)";

const DK_CENTER: [number, number] = [10.5, 56.0];
const DK_ZOOM = 6.4;

// Radius i km for "Nær mig". Konstant som brief anbefaler (kan senere
// gøres til en indstilling i Settings).
const NEAR_ME_RADIUS_KM = 25;

// Brief 14 (rettelse): farve = urgency, bogstav = segment.
// Aldrig-besøgt A/B/C er rød — en klassificeret kunde vi aldrig har
// set skal besøges. Kun X/L (no_urgency) er dæmpet. Nettoresultat for
// sælgeren: rød = tag derhen, dæmpet = spring over.
//
// Brief 33 §4: MapLibre paint-property tager ikke CSS-var direkte,
// så vi læser tokens.css runtime ved mount og bruger værdierne. Én
// helper, seks hits — dermed slår en ændring i tokens.css også
// igennem her (efter reload).
function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

const URGENCY_COLORS: Record<string, string> = {
  overdue: readToken("--st-red", "#A32020"),
  never_visited: readToken("--st-red", "#A32020"),
  soon: readToken("--st-amber", "#A8620A"),
  on_plan: readToken("--st-green", "#226638"),
  no_urgency: readToken("--fg-3", "#8A8782"),
};

function pinColor(c: FeltCustomer): string {
  return URGENCY_COLORS[c.priority.status] ?? URGENCY_COLORS.no_urgency;
}

function pinLetter(c: FeltCustomer): string {
  const seg = c.extension?.segment;
  return seg && "ABCXL".includes(seg) ? seg : "X";
}

function statusLabel(
  c: FeltCustomer,
  translate: (k: string, o?: Record<string, unknown>) => string,
): string {
  const s = c.priority.status;
  if (s === "overdue") {
    // Brief 43: humaniser lang varighed. Se humanDuration.ts.
    return humanOverdue(c.priority.daysOverdue);
  }
  if (s === "soon") return translate("lago.customer_list.status.soon");
  if (s === "on_plan") return translate("lago.customer_list.status.on_plan");
  if (s === "no_urgency") return translate("lago.customer_list.status.no_urgency");
  return translate("lago.customer_list.status.never_visited");
}

function formatNextVisit(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function coordsOf(c: FeltCustomer): { lat: number; lng: number } | null {
  const ext = c.extension as
    | (FeltCustomer["extension"] & { _lat?: number; _lng?: number })
    | null;
  if (!ext || typeof ext._lat !== "number" || typeof ext._lng !== "number") {
    return null;
  }
  return { lat: ext._lat, lng: ext._lng };
}

/** Haversine — km mellem to koordinater. Bruges til "Nær mig". */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Brief 14 (rettelse 2): filter-shape flyttet til feltFilters.ts —
// deles med DagensPage. Kort-siden holder styr på distrikt lokalt (ikke
// del af det fælles panel — chippet ligger i sidepanelet).

export function KortPage() {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const [filters, setFilters] = useState<FeltFilters>(defaultFeltFilters);
  const [distrikt, setDistrikt] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  // Brief 17 (bugfix): increment ved hvert gyldigt tryk på "Nær mig" så
  // MapCanvas re-fitter selv når koordinaterne er identiske med sidst.
  const [nearMeTick, setNearMeTick] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Brief 14: første tap åbner en callout (peek), ikke rail. Åbn-knappen
  // i callouten flytter så customer'en over i rail.
  const [peekedId, setPeekedId] = useState<number | null>(null);
  const [totalMissing, setTotalMissing] = useState<number>(0);

  const intervals = useVisitIntervals();
  // Brief 14 (rettelse 2): onlyMine er nu klient-side (via FeltFilters),
  // så counts + Dagens tæller over samme grundmængde. Én query, ingen
  // refetch når "Mine kunder" tændes.
  // Brief 26 §2 (rev. 16. sep 2026): serverside skjuler inaktive som
  // standard; Vis inaktive-toggle udløser refetch og løfter dem frem.
  const query = useQuery({
    queryKey: [
      "lago-kort-customers",
      { intervals, showInactive: filters.showInactive },
    ],
    queryFn: () =>
      fetchKortCustomers({
        mySalesId,
        intervals,
        includeInactive: filters.showInactive,
      }),
  });

  // Track how many customers *don't* have coordinates so we can hint the
  // sælger why counts don't add up.
  const totalQuery = useQuery({
    queryKey: ["lago-kort-total"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      // Brief 26 §2 (rev. 16. sep 2026): distrikt-synlig OG aktiv.
      // Kortet viser kun kunder man aktivt handler på — inaktive skal
      // ikke tælles ind i "5 kunder mangler koordinater"-hintet.
      const [total, missing] = await Promise.all([
        supabase
          .from("companies_lago")
          .select("company_id", { head: true, count: "exact" })
          .eq("is_visible_to_sales", true)
          .eq("is_active", true)
          .not("visma_customer_no", "is", null),
        supabase
          .from("companies_lago")
          .select("company_id", { head: true, count: "exact" })
          .eq("is_visible_to_sales", true)
          .eq("is_active", true)
          .not("visma_customer_no", "is", null)
          .or("lat.is.null,lng.is.null"),
      ]);
      return {
        total: total.count ?? 0,
        missing: missing.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (totalQuery.data) setTotalMissing(totalQuery.data.missing);
  }, [totalQuery.data]);

  const nowIso = useMemo(() => new Date().toISOString(), [query.data]);

  // Brief 17 (Nær mig-forenkling): "Nær mig" er nu ren recenter — den
  // skjuler ikke længere pins. Alle kunder der matcher filtre + distrikt
  // vises, uanset om brugeren har trykket "Nær mig" eller ej.
  const filtered = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter((c) => {
      if (!passesFeltFilters(c, filters, mySalesId, nowIso)) return false;
      if (distrikt && c.extension?.distrikt !== distrikt) return false;
      return true;
    });
  }, [query.data, filters, mySalesId, nowIso, distrikt]);

  // Brief 14 (addendum 2): kontekst-følsomme counts — hver count viser
  // "hvor mange matcher denne facet inden for det andre grupper begrænser
  // til". Base-grundmængden er ens på kort og Dagens.
  const filterCounts = useMemo(
    () => computeFeltFilterCounts(query.data ?? [], filters, mySalesId, nowIso),
    [query.data, filters, mySalesId, nowIso],
  );

  const distinctDistrikter = useMemo(() => {
    const s = new Set<string>();
    for (const c of query.data ?? []) {
      if (c.extension?.distrikt) s.add(c.extension.distrikt);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da"));
  }, [query.data]);

  const geojson = useMemo(() => {
    const nowIso = new Date().toISOString();
    const features: unknown[] = [];
    for (const c of filtered) {
      const coord = coordsOf(c);
      if (!coord) continue;
      const nextVisit = c.extension?.next_visit_planned ?? null;
      const planned = !!(nextVisit && nextVisit > nowIso);
      features.push({
        type: "Feature",
        properties: {
          id: c.id,
          color: pinColor(c),
          letter: pinLetter(c),
          planned,
        },
        geometry: { type: "Point", coordinates: [coord.lng, coord.lat] },
      });
    }
    return { type: "FeatureCollection" as const, features };
  }, [filtered]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const peekedCoords = useMemo<[number, number] | null>(() => {
    if (peekedId == null) return null;
    const c = filtered.find((x) => x.id === peekedId);
    const co = c ? coordsOf(c) : null;
    return co ? [co.lng, co.lat] : null;
  }, [peekedId, filtered]);

  // Brief 17 (bugfix "Nær mig"): koordinater på ALLE kunder inden for
  // 25 km af nearMe — uafhængigt af segment/besøg-filtre. Bruges til
  // fitBounds så framingen dækker brugeren + hele det nære område,
  // ikke kun det aktivt-filtrerede subset.
  const nearbyPoints = useMemo<Array<[number, number]>>(() => {
    if (!nearMe || !query.data) return [];
    const out: Array<[number, number]> = [];
    for (const c of query.data) {
      const co = coordsOf(c);
      if (!co) continue;
      if (haversineKm(nearMe, co) > NEAR_ME_RADIUS_KM) continue;
      out.push([co.lng, co.lat]);
    }
    return out;
  }, [nearMe, query.data]);

  const getPeekInfo = useCallback(
    (id: number): PeekInfo | null => {
      const c = filtered.find((x) => x.id === id);
      if (!c) return null;
      return {
        name: c.name,
        statusLabel: statusLabel(c, translate),
        statusColor: pinColor(c),
        nextVisitLabel: formatNextVisit(
          c.extension?.next_visit_planned ?? null,
        ),
      };
    },
    [filtered, translate],
  );

  const askNearMe = useCallback(() => {
    // Brief 17 (Nær mig-forenkling): ingen toggle længere — hvert tryk
    // er en engangs-recenter-handling. Filter-siden er fjernet fra
    // datasettet, så nearMe styrer kun kamera + markør.
    if (!("geolocation" in navigator)) {
      toast.error(translate("lago.felt.kort.near_me_no_api"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearMe({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        // Fyr ved hvert gyldigt tryk, ikke kun ved null→placering.
        setNearMeTick((t) => t + 1);
      },
      (err) => {
        // Håndtér alle tre PositionError-koder. Faldback: kortet står
        // uændret, filteret aktiveres ikke, ingen råt error i UI.
        let key: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            key = "lago.felt.kort.near_me_geo_denied";
            break;
          case err.POSITION_UNAVAILABLE:
            key = "lago.felt.kort.near_me_geo_unavailable";
            break;
          case err.TIMEOUT:
            key = "lago.felt.kort.near_me_geo_timeout";
            break;
          default:
            key = "lago.felt.kort.near_me_geo_generic";
        }
        toast.error(translate(key), { duration: 5000 });
      },
      { maximumAge: 60_000, timeout: 8_000, enableHighAccuracy: false },
    );
  }, [translate]);

  return (
    <div
      className="relative flex min-h-[560px] flex-1"
      style={{ height: "calc(100dvh - 180px)" }}
    >
      {!isMobile && (
        <aside className="border-r bg-background z-10 w-[260px] overflow-y-auto">
          <KortLensPanel
            filters={filters}
            onFiltersChange={setFilters}
            counts={filterCounts}
            distinctDistrikter={distinctDistrikter}
            distrikt={distrikt}
            onDistriktChange={setDistrikt}
            onRecenterToMe={askNearMe}
            hasMySalesId={mySalesId != null}
            geocodeMissingCount={totalMissing}
          />
        </aside>
      )}
      <div className="relative flex-1">
        <MapCanvas
          geojson={geojson}
          onPinTap={(id) => setPeekedId(id)}
          onOpenInRail={(id) => {
            setSelectedId(id);
            setPeekedId(null);
          }}
          getPeekInfo={getPeekInfo}
          peekedId={peekedId}
          peekedCoords={peekedCoords}
          onClosePeek={() => setPeekedId(null)}
          userLocation={nearMe}
          nearbyPoints={nearbyPoints}
          recenterTick={nearMeTick}
        />
        {/* Brief 66 §2 (18. sep 2026): tre tilstande — henter/tomt/fejl.
            Loading-overlay skjuler "X af Y"-linjen indtil svaret er der,
            saa den linje ikke modsiger skaermen. Empty vises kun naar
            svaret er kommet OG var tomt. Fejl baerer versionsnummeret
            saa et skaermbillede har hash'en med. */}
        {query.isPending ? (
          <KortOverlay>Henter kunder…</KortOverlay>
        ) : query.error ? (
          <KortOverlay>
            Kunne ikke hente kunderne. Prøv at genindlæse.
            <div className="mt-1 text-[12px] text-[var(--fg-3)]">
              Version {getAppVersion()}
            </div>
          </KortOverlay>
        ) : filtered.length === 0 ? (
          <KortOverlay>Ingen kunder matcher filtrene.</KortOverlay>
        ) : (
          <div className="text-muted-foreground pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-2 py-0.5 text-sm backdrop-blur-sm">
            {translate("lago.felt.kort.showing", {
              shown: filtered.length,
              total: query.data?.length ?? 0,
            })}
          </div>
        )}
        {isMobile && (
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap gap-1.5">
            {/* Brief 16: mobil får det fulde panel via bottom-sheet i
                stedet for det lodrette sidepanel. Nær mig som separat
                quick-action (kort-specifik). */}
            <MobileFilterButton
              filters={filters}
              onFiltersChange={setFilters}
              counts={filterCounts}
              hasMySalesId={mySalesId != null}
              className="shadow bg-background"
              extras={
                <>
                  {distinctDistrikter.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-1 text-xs font-bold uppercase tracking-widest">
                        {translate("lago.customer_list.filter_district_label")}
                      </div>
                      <Select
                        value={distrikt ?? "__all__"}
                        onValueChange={(v) =>
                          setDistrikt(v === "__all__" ? null : v)
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">
                            {translate("lago.customer_list.filter_district_all")}
                          </SelectItem>
                          {distinctDistrikter.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {totalMissing > 0 && (
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                      {translate("lago.felt.kort.no_coords_hint", {
                        smart_count: totalMissing,
                        missing: totalMissing,
                      })}
                    </p>
                  )}
                </>
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-md px-3 text-sm shadow"
              onClick={askNearMe}
            >
              <Icon icon={Compass} size="sm" />
              {translate("lago.felt.kort.near_me")}
            </Button>
          </div>
        )}
        <MapLegend />
        {query.isLoading && (
          <div className="text-muted-foreground bg-background/70 absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Icon icon={Loader2} className="animate-spin" />
            {translate("lago.felt.kort.loading")}
          </div>
        )}
        {query.error && (
          <div className="text-destructive bg-background/70 absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Icon icon={AlertCircle} />
            {(query.error as Error).message}
          </div>
        )}
      </div>

      {isMobile ? (
        <Sheet
          open={selected != null}
          onOpenChange={(v) => !v && setSelectedId(null)}
        >
          <SheetContent
            side="bottom"
            className="max-h-[80vh] overflow-y-auto p-3"
          >
            {/* Brief 66 §4b (18. sep 2026): tom SheetHeader-stribe er
                væk. sr-only titel bevares for Radix a11y-krav, men
                indholdskortets øverste linje er nu headeren. Ét ✕
                (Sheets indbyggede, absolut positioneret top-right). */}
            <SheetTitle className="sr-only">
              {selected?.name ?? "Kunde"}
            </SheetTitle>
            {selected && (
              <CustomerCard customer={selected} variant="sheet" />
            )}
          </SheetContent>
        </Sheet>
      ) : (
        selected && (
          <aside className="border-l bg-background z-10 w-[380px] overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                Kunde
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedId(null)}
              >
                {translate("lago.felt.kort.pin_close")}
                <Icon icon={X} size="sm" />
              </Button>
            </div>
            <CustomerCard customer={selected} variant="list" />
          </aside>
        )
      )}
    </div>
  );
}

/**
 * Brief 14: slank legend — kun de 4 urgency-farver + planlagt-ikon.
 * Bogstav-forklaringen (A/B/C/X/L) er droppet; segmentet står i selve
 * pinnen og "hyppig/standard/sjælden" var direkte misvisende.
 */
function MapLegend() {
  return (
    <div className="bg-background/95 border-border pointer-events-none absolute bottom-8 left-3 z-10 max-w-[220px] rounded-md border p-2 text-sm shadow-sm">
      <div className="text-muted-foreground mb-1 font-bold uppercase tracking-wider">
        Farve = besøg
      </div>
      {/* Brief 33 §4: legend-farver spejler URGENCY_COLORS (som selv
          læser tokens.css). Én kilde til sandhed for kort + legend. */}
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <LegendDot color={URGENCY_COLORS.overdue} label="Skal besøges" />
        <LegendDot color={URGENCY_COLORS.soon} label="Snart" />
        <LegendDot color={URGENCY_COLORS.on_plan} label="Ajour" />
        <LegendDot color={URGENCY_COLORS.no_urgency} label="Ingen data" />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
          style={{ background: "var(--st-blue)" }}
        />
        = planlagt besøg
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

export interface PeekInfo {
  name: string;
  statusLabel: string;
  statusColor: string;
  nextVisitLabel: string | null;
}

interface MapCanvasProps {
  geojson: { type: "FeatureCollection"; features: unknown[] };
  /** Brief 14: første tap åbner en callout, ikke rail'en. */
  onPinTap: (id: number) => void;
  /** Åbn "for real" — kaldes fra Åbn-knappen i callout. */
  onOpenInRail: (id: number) => void;
  /** Sync-info til callout-visning. */
  getPeekInfo: (id: number) => PeekInfo | null;
  peekedId: number | null;
  peekedCoords: [number, number] | null;
  onClosePeek: () => void;
  /**
   * Brugerens position når "Nær mig" er aktiveret. Null = ingen markør.
   * Ved non-null vises en diskret blå "her er du"-markør.
   */
  userLocation: { lat: number; lng: number } | null;
  /**
   * Koordinater på kunder inden for 25 km af userLocation. Bruges til
   * at fitBounds så både brugeren og de nærmeste pins er i view.
   */
  nearbyPoints: Array<[number, number]>;
  /**
   * Increment ved hvert tryk på "Nær mig" (successful geo-fetch), så
   * kortet re-fitter selv når userLocation-referencen er den samme
   * som sidst (fx browser cachede koordinaterne).
   */
  recenterTick: number;
}

function MapCanvas({
  geojson,
  onPinTap,
  onOpenInRail,
  getPeekInfo,
  peekedId,
  peekedCoords,
  onClosePeek,
  userLocation,
  nearbyPoints,
  recenterTick,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // Brief 17 (bugfix "Nær mig"): DOM-marker for brugerens position.
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Kilde-af-sandhed for pin-features: en ref der altid holder den
  // nyeste geojson. Uden dette ville map.on('load')-callbacken bruge
  // sit closure-snapshot fra første render (typisk tom) — pins ville
  // aldrig blive tegnet efter query'en er resolvet.
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;
  // Callbacks + info holdes i refs, så listener-registreringen ikke
  // re-runner effekten (og bygger nyt map) når parent renderer.
  const onPinTapRef = useRef(onPinTap);
  onPinTapRef.current = onPinTap;
  const onOpenInRailRef = useRef(onOpenInRail);
  onOpenInRailRef.current = onOpenInRail;
  const getPeekInfoRef = useRef(getPeekInfo);
  getPeekInfoRef.current = getPeekInfo;
  const onClosePeekRef = useRef(onClosePeek);
  onClosePeekRef.current = onClosePeek;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Brief 66 §1 (18. sep 2026): kort startes med TOM style — ingen
    // sources, ingen layers. MapLibre parser den synkront (intet at
    // hente), og `map.on("load", ...)` fyrer straks. Pins-source +
    // layers tilfoejes foerst. Basemap-raster tilfoejes DEREFTER som
    // en almindelig source med `beforeId` = "clusters", saa den ligger
    // under pins-lagene. Naalene kan pr. konstruktion ikke vente paa
    // tiles, fordi kortet aldrig havde en tile-source da laget blev
    // oprettet — det er ikke en gate, det er en afhaengighed der ikke
    // findes. Med CARTO blokeret rendres pins paa hvid baggrund.
    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [],
        // MapLibre kraever en glyphs-endpoint for cluster-tal og
        // pin-bogstaver (segment). OpenMapTiles' gratis font-server
        // virker fra github.io.
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      } as any,
      center: DK_CENTER,
      zoom: DK_ZOOM,
      minZoom: 5,
      maxZoom: 17,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    // Brief 66 §1 (18. sep 2026): forsoegt refactor til at bryde
    // afhaengigheden af tile-load. Testet med tre gates (isStyleLoaded,
    // once('styledata'), once('style.load'), poll via rAF) — ingen af
    // dem fik pins til at vises hverken paa hvid baggrund (CARTO
    // blokeret) eller pauselignende. Rolled back til original 'load'-
    // event. Diagnose staar: kaeden er nal tegnes ved 'load' som
    // venter paa tiles. Rettelsen kraever formentlig en source-tilfoej-
    // strategi der ikke lever inde i map.on(load), fx en anden basemap-
    // provider der er hurtig/pallidelig (Dataforsyningen). Foelges op.
    map.on("load", () => {
      map.addSource("customers", {
        type: "geojson",
        data: geojsonRef.current as any,
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 12,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "customers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": readToken("--ink", "#1C1B1A"),
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            22,
            50,
            28,
          ],
          "circle-opacity": 0.85,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "customers",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "customers",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 10,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      // Brief 13: bogstavet (segment) ovenpå prikken. Redundant kodning
      // (farve + bogstav) afbøder farveblindhed.
      map.addLayer({
        id: "pin-letter",
        type: "symbol",
        source: "customers",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "letter"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });
      // Brief 14: planlagt-badge — blå prik i pinnens øverste højre
      // hjørne når en fremtidig aftale er booket. Overleve alle farver.
      map.addLayer({
        id: "pin-planned-badge",
        type: "circle",
        source: "customers",
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["==", ["get", "planned"], true],
        ],
        paint: {
          "circle-color": readToken("--st-blue", "#2A47A8"),
          "circle-radius": 4.5,
          "circle-translate": [8, -8],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("click", "pins", (e) => {
        const feat = e.features?.[0];
        const id = feat?.properties?.id;
        if (typeof id === "number") onPinTapRef.current(id);
      });
      map.on("mouseenter", "pins", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "pins", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "clusters", (e) => {
        const feat = e.features?.[0];
        const clusterId = feat?.properties?.cluster_id;
        const source = map.getSource("customers") as any;
        if (source?.getClusterExpansionZoom && clusterId != null) {
          source.getClusterExpansionZoom(
            clusterId,
            (err: unknown, zoom: number) => {
              if (err) return;
              const coords = (feat?.geometry as any).coordinates;
              map.easeTo({ center: coords, zoom });
            },
          );
        }
      });
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      // Brief 66 §1: basemap-raster tilfoejes EFTER pins-lagene, med
      // `beforeId="clusters"` saa den ligger UNDER pins i lagstakken.
      // Nu er pins allerede tegnet — CARTO's tiles er en visuel
      // baggrund der siver ind bagefter og aldrig kan blokere pins.
      if (!map.getSource("basemap")) {
        map.addSource("basemap", {
          type: "raster",
          tiles: TILE_URLS,
          tileSize: 256,
          attribution: TILE_ATTRIBUTION,
        });
        map.addLayer(
          {
            id: "basemap",
            type: "raster",
            source: "basemap",
            minzoom: 0,
            maxzoom: 19,
          },
          "clusters",
        );
      }
    });
    mapRef.current = map;

    // Genindlaes pin-source hvis map.load allerede har fyret foer effekt-
    // kaldet (fx ved re-mount efter hot-reload).
    const onLoadResize = () => map.resize();
    map.on("load", onLoadResize);

    // Observere containeren så maplibre re-flow'er når panelet
    // slås til/fra eller sheet'en åbnes — ellers står kortet ofte i 0×0
    // efter en layoutændring.
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Map opsættes én gang på mount. Klik-callback + geojson holdes i
    // refs (ovenfor), så de er altid friske uden at re-mounte kortet.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("customers") as any;
      if (src?.setData) src.setData(geojson);
    };
    // Hvis style-loaden endnu ikke er koert, venter vi paa 'load' —
    // ellers landede pin-data'en foer source var oprettet og setData
    // ville bare returnere no-op.
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [geojson]);

  // Brief 14: callout-Popup for det peeked pin. Vi bygger DOM imperativt
  // så MapLibres native Popup håndterer positionering + luk-mekanik.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || peekedId == null || !peekedCoords) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    const info = getPeekInfoRef.current(peekedId);
    if (!info) return;

    const dom = document.createElement("div");
    dom.style.font =
      "13px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    dom.style.minWidth = "180px";
    dom.style.padding = "2px 4px 6px";
    // Brief 33 §4: inline-HTML style-attributter kan bruge CSS-var
    // direkte — så tooltip'ens neutrale toner spejler tokens.css.
    dom.innerHTML = `
      <div style="font-weight:600;margin-bottom:2px;">${escapeHtml(info.name)}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg-2);">
        <span style="width:8px;height:8px;border-radius:50%;background:${info.statusColor};box-shadow:0 0 0 1.5px #fff;"></span>
        <span>${escapeHtml(info.statusLabel)}</span>
      </div>
      <div style="font-size:11px;color:var(--fg-2);margin-top:4px;">
        ${info.nextVisitLabel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + escapeHtml(info.nextVisitLabel) : "<span style='color:var(--fg-3);'>Ingen aftale</span>"}
      </div>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Åbn";
    // Brief 66 §5 (18. sep 2026): chevronen droppet — knappen er sort
    // og hedder "Åbn", der er ingen tvivl om at den fører videre. Uden
    // chevronen kan der heller ikke opstaa linjeskift midt i knappen.
    // white-space:nowrap som livrem: hvis knap-teksten en dag bliver
    // laengere, bryder den ikke over to linjer.
    btn.style.cssText = `
      display:block;margin-top:8px;padding:6px 10px;font-size:12px;
      border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:4px;
      cursor:pointer;width:100%;text-align:center;white-space:nowrap;
    `;
    btn.onclick = () => onOpenInRailRef.current(peekedId);
    dom.appendChild(btn);

    popupRef.current?.remove();
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      offset: [0, -12],
      maxWidth: "240px",
    })
      .setLngLat(peekedCoords)
      .setDOMContent(dom)
      .addTo(map);
    popup.on("close", () => onClosePeekRef.current());
    popupRef.current = popup;
    return () => {
      popup.remove();
    };
  }, [peekedId, peekedCoords]);

  // Brief 17 (bugfix "Nær mig" — del 1): diskret "her er du"-markør.
  // Adskilt fra recenter-effekten så vi kan style og opdatere position
  // uden at røre kamera-flytningen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    const dot = document.createElement("div");
    // Brief 33 §4: user-marker'en spejler --st-blue. rgba-halo har
    // ikke en direkte token, men matcher blå-familien og bevares.
    dot.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--st-blue);
      box-shadow: 0 0 0 4px rgb(from var(--st-blue) r g b / 0.25), 0 0 0 2px #fff inset;
    `;
    userMarkerRef.current?.remove();
    const marker = new maplibregl.Marker({ element: dot })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
    userMarkerRef.current = marker;
    return () => {
      marker.remove();
      if (userMarkerRef.current === marker) userMarkerRef.current = null;
    };
  }, [userLocation]);

  // Brief 17 (bugfix "Nær mig" — del 2): kamera-flytning. Trigger'es
  // både ved skift af userLocation OG ved recenterTick — sidstnævnte
  // sørger for at gentryk (samme koordinater) også re-framer.
  //
  // Ingen load-gate: `map.loaded()` er transient false når source-
  // setData kører (fx samtidig med filter-skift), og `once("load")`
  // fyrer ikke igen efter allerførste load — så gaten faldt igennem
  // og doFit() blev aldrig kaldt. fitBounds/flyTo er sikre at kalde
  // så snart mapRef.current findes; kortet behøver ikke være style-
  // loaded for at modtage kamera-kommandoer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    // Framing: bruger + 25 km-kunder → fitBounds med lidt padding.
    // Fald tilbage til flyTo(zoom 10) hvis brugeren står alene (fx
    // uden for DK eller uden koord-kunder).
    if (nearbyPoints.length === 0) {
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 10,
        speed: 1.2,
        essential: true,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds(
      [userLocation.lng, userLocation.lat],
      [userLocation.lng, userLocation.lat],
    );
    for (const [lng, lat] of nearbyPoints) {
      bounds.extend([lng, lat]);
    }
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 60, right: 60 },
      maxZoom: 12,
      duration: 1000,
      essential: true,
    });
  }, [userLocation, recenterTick, nearbyPoints]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/**
 * Brief 66 §2 (18. sep 2026): overlay-kort til henter/tomt/fejl. Sidder
 * over map-canvas, aria-live saa skaermlaesere ogsaa hoerer skiftet.
 * Blaesig baggrund saa det tydeligt ligger OVER kortet — ikke bare "et
 * kort uden naale", som er den løgn briefen kalder ud.
 */
function KortOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-lg bg-background/85 px-4 py-2.5 text-center text-sm text-[var(--fg)] shadow-sm backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
