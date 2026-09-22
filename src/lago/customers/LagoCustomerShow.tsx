import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Icon } from "@/lago/ui/Icon";
import { LagoPullToRefresh } from "@/lago/ui/PullToRefresh";
import { StatusBadge } from "@/lago/ui/StatusBadge";
import { KreditSpaerreChip } from "@/lago/ui/KreditSpaerreChip";

import { useHasSideRail } from "@/lago/layout/useHasSideRail";

import { getLastListUrl } from "@/lago/layout/LagoScrollRestoration";

import { fetchLagoCustomer, upsertLagoExtension } from "./dataAccess";
import type { LagoCustomerData, SaveExtensionInput } from "./types";
import { CustomerActionBar } from "./CustomerActionBar";
import {
  LagoCustomerCard,
  HvadSketeDerSidstSection,
  AabneOpfoelgningerSection,
  AabneOrdrerSection,
  OmsaetningSection,
  KontaktpersonerSection,
  StamdataSection,
} from "./show/LagoCustomerCard";

/**
 * Brief 50 §2 (17. sep 2026) · mobil-header slået sammen til ét bånd.
 *
 * Før: navn stod i topbjælken OG i en KundeoverbikkSection lige under.
 * Segmentet stod to gange. VISMA-nr på én linje, adressen sekvenserede.
 * Fire linjers dobbeltkonfekt før sælgeren så noget nyt.
 *
 * Nu: én header med navn + segment højre, adresse (postnummer+by
 * sammen), VISMA-nr, og sticky action-bar under. Kundeoverblik-
 * sektionen renderes ikke længere på mobil — headeren ér overblikket.
 */
function MobileHeader({ data }: { data: LagoCustomerData }) {
  const translate = useTranslate();
  const navigate = useNavigate();
  const { company, extension } = data;
  // Brief 50 §2 + §5: adressen skrives i én form overalt — postnummer
  // og by som ét led ("6510 Gram"), · som separator ("Kongevej 8 ·
  // 6510 Gram"). Ingen komma mellem postnummer og by.
  const zipCity = [company.zipcode, company.city].filter(Boolean).join(" ");
  const address = [company.address, zipCity].filter(Boolean).join(" · ");
  // Brief 51 §3 (17. sep 2026): når man har rullet ned til Stamdata er
  // der intet på skærmen der siger hvilken kunde man kigger på —
  // action-baren viser tre knapper og ingen kontekst. IntersectionObserver
  // på headeren siger til når den ikke længere er synlig; så viser vi
  // navnet med småt over knapperne. Kun når klæbet — når headeren er
  // synlig ville linjen være gentagelse.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [stickyActive, setStickyActive] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyActive(!entry.isIntersecting),
      { rootMargin: "0px 0px -100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={headerRef} className="border-b bg-[var(--surface)]">
        <div className="px-4 pt-3 pb-4">
          {/* Tilbage-linje står alene så knappen har sin egen plads
              og navnet får hele bredden. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              // Brief 74 tillæg A (22. sep 2026): tilbage til den
              // filtrerede liste sælgeren kom fra, med scroll intakt.
              // state.restoreListScroll fortæller LagoScrollRestoration
              // at behandle denne PUSH som en tilbage-navigation
              // (navigate(-1) kan ikke bruges: den falder ud af appen
              // hvis kortet er åbnet direkte via bogmærke).
              navigate(getLastListUrl(), {
                state: { restoreListScroll: true },
              })
            }
            className="-ml-2 mb-2"
          >
            <Icon icon={ArrowLeft} size="sm" />
            {translate("ra.action.back", { _: "Tilbage" })}
          </Button>
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 truncate text-[length:var(--t-title)] font-bold tracking-tight text-[var(--fg)]">
              {company.name}
            </h1>
            {extension?.segment && (
              <StatusBadge variant="neutral">
                Segment {extension.segment}
              </StatusBadge>
            )}
          </div>
          {extension?.kreditspaerre === true && (
            <div className="mt-2">
              <KreditSpaerreChip spaerret={true} />
            </div>
          )}
          {address && (
            <p className="mt-2 flex items-center gap-1.5 text-[length:var(--t-sec)] text-[var(--fg-2)]">
              <Icon
                icon={MapPin}
                size="sm"
                className="shrink-0 text-[var(--fg-3)]"
              />
              <span className="truncate">{address}</span>
            </p>
          )}
          {extension?.visma_customer_no && (
            <p className="mt-1 text-[length:var(--t-meta)] text-[var(--fg-3)]">
              VISMA {extension.visma_customer_no}
            </p>
          )}
        </div>
      </div>
      {/* Brief 49 §4d: sticky action-bar med ugennemsigtig baggrund
          — så sektioner ikke skinner igennem under scroll.
          Brief 51 §3 (17. sep 2026): kundenavnet med småt over
          knapperne når headeren ikke længere er synlig. Kun mens
          bjælken klæber — ellers gentagelse. */}
      <div className="sticky top-0 z-10 border-b bg-[var(--surface)] px-4 py-3">
        {stickyActive && (
          <p className="mb-1 truncate text-[length:var(--t-meta)] text-[var(--fg-3)]">
            {company.name}
          </p>
        )}
        <CustomerActionBar
          companyId={company.id}
          companyName={company.name}
          address={company.address ?? null}
          zipcode={company.zipcode ?? null}
          city={company.city ?? null}
          phoneNumber={company.phone_number ?? null}
          hasSideRail={false}
        />
      </div>
    </>
  );
}

/**
 * Brief 49 §3 (17. sep 2026) · laptop-topbånd. ÉT bånd med navn,
 * badges, handlinger og adresse+CVR — ikke to. Vores tidligere layout
 * havde et bånd med navn/VISMA og endnu et bånd kun til Naviger/Ring,
 * som stod alene i 1300 px tomhed. Nu er alt samlet, handlingerne
 * højrestillet.
 */
function LaptopHeader({ data }: { data: LagoCustomerData }) {
  const translate = useTranslate();
  const navigate = useNavigate();
  const { company, extension } = data;
  // Brief 50 §2 (17. sep 2026): adresse i én form overalt —
  // "Adelgade 46 · 5400 Bogense", postnummer+by som ét led.
  // Brief 53 tillæg A §1 (17. sep 2026): CVR ud af topbåndet — den
  // hører hjemme i Stamdata som en almindelig række, ikke i header.
  const zipCity = [company.zipcode, company.city].filter(Boolean).join(" ");
  const addressLine = [company.address, zipCity].filter(Boolean).join(" · ");
  return (
    <div className="border-b bg-[var(--surface)]">
      <div className="mx-auto max-w-screen-2xl px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            // Brief 74 tillæg A (22. sep 2026): tilbage til dén liste.
            navigate(getLastListUrl(), {
              state: { restoreListScroll: true },
            })
          }
          className="mb-2 -ml-2"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {translate("ra.action.back", { _: "Tilbage til kundelisten" })}
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[length:var(--t-title)] font-bold tracking-tight text-[var(--fg)]">
                {company.name}
              </h1>
              {extension?.segment && (
                <StatusBadge variant="neutral">
                  Segment {extension.segment}
                </StatusBadge>
              )}
              {extension?.distrikt && (
                <StatusBadge variant="neutral">
                  Distrikt {extension.distrikt}
                </StatusBadge>
              )}
              <KreditSpaerreChip spaerret={extension?.kreditspaerre} />
            </div>
            {addressLine && (
              <p className="mt-1 text-[length:var(--t-sec)] text-[var(--fg-2)]">
                {addressLine}
              </p>
            )}
          </div>
          <div className="shrink-0">
            {/* hasSideRail=false gør at Registrér-knappen kommer med i
                CustomerActionBar — vi vil have alle tre knapper i
                topbåndet på laptop. */}
            <CustomerActionBar
              companyId={company.id}
              companyName={company.name}
              address={company.address ?? null}
              zipcode={company.zipcode ?? null}
              city={company.city ?? null}
              phoneNumber={company.phone_number ?? null}
              hasSideRail={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ZoneProps {
  data: LagoCustomerData;
  onUpdate: (input: SaveExtensionInput) => void;
  saving: boolean;
}

/**
 * Brief 49 §3 (17. sep 2026) · to spalter på laptop.
 *
 *   Venstre ~65 % — forløbet:
 *     Aktivitetshistorik · Åbne opfølgninger · Åbne ordrer
 *
 *   Højre ~35 % — fakta:
 *     Omsætning · Kontaktpersoner · Stamdata
 *
 * Registrér er i topbåndet, så højre spalte bærer FAKTA, ikke en knap.
 * Under 1024 px falder det sammen til mobilens ene spalte via
 * `PortraitFallback` (brug af `LagoCustomerCard` med skillelinjer).
 */
function LandscapeZones({ data }: ZoneProps) {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <main className="flex flex-col">
          <HvadSketeDerSidstSection data={data} layout="laptop" />
          <AabneOpfoelgningerSection
            tasks={data.openTasks}
            contacts={data.contacts}
            layout="laptop"
          />
          <AabneOrdrerSection extension={data.extension} layout="laptop" />
        </main>
        <aside className="flex flex-col">
          <OmsaetningSection extension={data.extension} layout="laptop" />
          <KontaktpersonerSection
            companyId={data.company.id}
            companyName={data.company.name}
            contacts={data.contacts}
            layout="laptop"
          />
          <StamdataSection data={data} layout="laptop" />
        </aside>
      </div>
    </div>
  );
}

function PortraitFallback({ data }: ZoneProps) {
  // Brief 45 §3: Registrér ligger i CustomerActionBar (sticky top). Én
  // lang kolonne med Stitchs otte sektioner — accordion + separate
  // paneler er fjernet, det var netop det brief 45 skulle rette.
  //
  // Brief 50 §5 (17. sep 2026): scroll-padding-top matcher den sticky
  // action-bars højde (~72 px = 44 knap + 12+12 padding + 4 border) så
  // when programmatic scroll/jump lander på en sektion, står
  // sektionsoverskriften UNDER bjælken — ikke under den. Sektioner
  // bærer scroll-mt så in-page anchor-jumps ryddes for det samme.
  return (
    <div
      className="px-4 py-4 [&_section]:scroll-mt-20"
      style={{ scrollPaddingTop: "72px" }}
    >
      <LagoCustomerCard data={data} />
    </div>
  );
}

/**
 * LAGO customer page — Domain-brief 3 mid-fi refinement of the kerne-
 * kundebillede. Landscape (>= 1024px) shows three zones: info-rail (left),
 * combined timeline + salgsudvikling (centre), and a fixed registration
 * column (right). Portrait falls back to a single-column view with an
 * accordion for info-cards and a sticky action bar that expands into the
 * full registration surface.
 */
export function LagoCustomerShow() {
  const params = useParams<{ id: string }>();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const hasSideRail = useHasSideRail();
  const companyId = params.id ? Number(params.id) : NaN;

  const query = useQuery({
    queryKey: ["lago-customer", companyId],
    queryFn: () => fetchLagoCustomer(companyId),
    enabled: Number.isFinite(companyId),
  });

  const mutation = useMutation({
    mutationFn: upsertLagoExtension,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["lago-customer", companyId],
      }),
  });

  if (!Number.isFinite(companyId)) {
    return (
      <div className="p-6 text-sm text-destructive">
        {translate("lago.customer.errors.bad_id")}
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Icon icon={Loader2} className="animate-spin" />
        {translate("lago.customer.loading")}
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="p-6 text-sm text-destructive">
        {translate("lago.customer.errors.load_failed", {
          _: "Kunne ikke hente kunden.",
        })}{" "}
        {(query.error as Error | undefined)?.message}
      </div>
    );
  }

  const data = query.data;
  const zoneProps: ZoneProps = {
    data,
    onUpdate: mutation.mutate,
    saving: mutation.isPending,
  };

  return (
    <LagoPullToRefresh>
      <div>
        {hasSideRail ? (
          <>
            <LaptopHeader data={data} />
            <LandscapeZones {...zoneProps} />
          </>
        ) : (
          <>
            <MobileHeader data={data} />
            <PortraitFallback {...zoneProps} />
          </>
        )}
      </div>
    </LagoPullToRefresh>
  );
}
