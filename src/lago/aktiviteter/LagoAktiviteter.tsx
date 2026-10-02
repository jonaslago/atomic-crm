import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button as LagoButton } from "@/lago/ui/Button";
import { ExpandableNote } from "@/lago/ui/ExpandableNote";
import { StatusBadge } from "@/lago/ui/StatusBadge";
import { shortenSalesName } from "@/lago/ui/shortenSalesName";
import { thisIsoWeek, toIsoDate } from "@/lago/ui/periodRange";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/lago/ui/Icon";
import { LagoPullToRefresh } from "@/lago/ui/PullToRefresh";
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import {
  usePortefolje,
  useViewSalesId,
} from "@/lago/portefolje/PortefoljeContext";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";

import { fetchAktivitetsside, type ActivityRow } from "./dataAccess";

/**
 * Brief 44 · Aktivitetssiden (16. sep 2026).
 *
 * Kontorets flade — mere end sælgerens. To lister, foran os og bag os,
 * med fælles filtre der står i URL'en. Ingen handlingsknapper i
 * rækkerne (§2 — det er en oversigt, ikke et arbejdsbord).
 *
 * Filtrenes standard afhænger af rolle:
 *   saelger → person = mig, periode = denne måned
 *   kontor/ledelse/admin → person = alle, periode = denne måned
 *
 * URL-parametre: person, types, q, period, from, to. Ændring i
 * filtrene skriver til URL med replace, ikke push — sælgeren skal ikke
 * bygge en stor tilbagestak af filter-permutationer.
 */

// Brief 87 tillæg (28. sep 2026): "kommende" er fra i dag og frem, uden
// slutdato. Var manglende værdi — link'et "Se alle kommende besøg" fra
// forsiden pegede tidligere på kundelisten pga. den. Filteret understøtter
// allerede custom med from/to, så det er en værdi mere, ikke en ny mekanik.
type PeriodKey = "all" | "week" | "month" | "custom" | "kommende";

// §24f (1. okt 2026): "Aftale" filter removed. Planned visits are now
// real activities (kind="activity", typeCode=1), not a separate kind.
// They appear in "Foran os" by date like any other activity.
const TYPE_OPTIONS: Array<{
  code: string;
  label: string;
  matches: (r: ActivityRow) => boolean;
}> = [
  { code: "besoeg", label: "Besøg", matches: (r) => r.typeCode === 1 },
  { code: "event", label: "Event", matches: (r) => r.typeCode === 10 },
  { code: "opkald", label: "Opkald", matches: (r) => r.typeCode === 5 },
  { code: "kampagne", label: "Kampagne", matches: (r) => r.typeCode === 2 },
  { code: "opgave", label: "Opgave", matches: (r) => r.kind === "task" },
];

const ALL_PERSONS = "__all__";
const NO_OWNER = "__unassigned__";

// §12 (29. sep 2026): uge-beregning flyttet til src/lago/ui/periodRange.
// Én implementation deles nu af aktivitetssiden og forsidens widgets,
// så "Denne uge" betyder samme vindue overalt. Historisk brugte den
// gamle version toISOString().slice(0,10) som konverterer til UTC og
// kunne flytte datoen med en dag i sen aften — nyversion bruger lokal
// dato.
function startOfWeekIso(): string {
  return thisIsoWeek().fromIso;
}

function endOfWeekIso(): string {
  return thisIsoWeek().toIso;
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return toIsoDate(d);
}

function endOfMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(0, 0, 0, 0);
  return toIsoDate(d);
}

function todayIsoDate(): string {
  return toIsoDate(new Date());
}

// Brief 87 tillæg (28. sep 2026): sentinel-dato for "kommende"-periode.
// MÅ ALDRIG renderes i brugerfladen. Bruges kun i .lte()-sammenligning
// mod postgres. Vises perioden nogensinde skal det være som "Kommende
// (fra i dag)". Custom-inputtenes defaults (startOfMonthIso / endOfMonthIso)
// bruges hvis brugeren skifter til Vælg datoer, så sentinel ikke slipper
// ind i from/to-state.
const FAR_FUTURE_ISO = "9999-12-31";

const FAR_PAST_ISO = "2020-01-01";

function periodRange(
  period: PeriodKey,
  from: string | null,
  to: string | null,
): { fromIso: string; toIso: string } {
  if (period === "all") return { fromIso: FAR_PAST_ISO, toIso: FAR_FUTURE_ISO };
  if (period === "week")
    return { fromIso: startOfWeekIso(), toIso: endOfWeekIso() };
  if (period === "custom") {
    // Guard: hvis URL'en er blevet manipuleret så to=FAR_FUTURE_ISO
    // lander i custom-mode, faldbag til månedens slut. Ellers ville
    // sentinel'en havne i <Input type="date"> og rendere.
    const safeTo = to === FAR_FUTURE_ISO ? endOfMonthIso() : to;
    return {
      fromIso: from ?? startOfMonthIso(),
      toIso: safeTo ?? endOfMonthIso(),
    };
  }
  if (period === "kommende")
    return { fromIso: todayIsoDate(), toIso: FAR_FUTURE_ISO };
  return { fromIso: startOfMonthIso(), toIso: endOfMonthIso() };
}

export function LagoAktiviteter() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Brief 87 tillæg (28. sep 2026): læsning følger den portefølje man er
  // i — samme regel som de ni widgets vi rettede 28. sep om morgenen.
  // Før brugte defaultPerson `identity.id` (actor), så en Camillas dækker
  // så sine egne aktiviteter i menu-klikket, ikke Camillas — uden at
  // det blev sagt. Nu bruges viewSalesId; URL'ens `?person=` overstyrer
  // fortsat manuelt valg.
  const { isLoading: roleLoading } = useCurrentLagoRole();
  const { viewRole: role } = usePortefolje();
  const viewSalesId = useViewSalesId();
  // "(mig)"-mærket på person-vælgeren skal ALTID pege på den, der er
  // logget ind — ikke den, man dækker for. Under dækning står mig
  // stadig på Jonas' sales_id, ikke Camillas.
  const actorSalesId = useActorSalesId();

  const defaultPerson = useMemo(() => {
    if (roleLoading) return ALL_PERSONS;
    if (role === "saelger" && viewSalesId != null) return String(viewSalesId);
    return ALL_PERSONS;
  }, [role, roleLoading, viewSalesId]);

  const person = searchParams.get("person") ?? defaultPerson;
  // §98-4a (1. okt 2026): "Alt" is the default period.
  const period = (searchParams.get("period") as PeriodKey) ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q") ?? "";
  const typesRaw = searchParams.get("types") ?? "";
  const activeTypes = useMemo(
    () => new Set(typesRaw.split(",").filter(Boolean)),
    [typesRaw],
  );

  const [customerSearch, setCustomerSearch] = useState(q);
  const deferredQ = useDeferredValue(customerSearch);

  // Skriv til URL med replace — filter-permutationer skal ikke fylde
  // tilbagestakken.
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  const { fromIso, toIso } = periodRange(period, from, to);
  const query = useQuery({
    queryKey: ["lago-aktivitetsside", fromIso, toIso],
    queryFn: () => fetchAktivitetsside({ fromIso, toIso }),
    staleTime: 60_000,
  });

  const distinctOwners = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of query.data ?? []) {
      if (r.ownerSalesId != null && r.ownerName) {
        map.set(r.ownerSalesId, r.ownerName);
      }
    }
    return Array.from(map.entries())
      .map(([salesId, name]) => ({ salesId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
  }, [query.data]);

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const needle = deferredQ.trim().toLowerCase();
    const anyType = activeTypes.size === 0;
    return rows.filter((r) => {
      // Person: alle, en navngiven, eller "ikke tildelt" (Backoffice-køen).
      if (person !== ALL_PERSONS) {
        if (person === NO_OWNER) {
          if (r.ownerSalesId != null) return false;
        } else {
          if (String(r.ownerSalesId ?? "") !== person) return false;
        }
      }
      // Kunde: tekstsøg på company-navn.
      if (needle && !r.companyName.toLowerCase().includes(needle)) return false;
      // Type: unionen af valgte kategorier.
      if (!anyType) {
        const matches = TYPE_OPTIONS.some(
          (t) => activeTypes.has(t.code) && t.matches(r),
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [query.data, deferredQ, activeTypes, person]);

  // §10c (29. sep 2026): overskredne åbne opgaver kan ligge uden for
  // periodefilteret. De vises altid — i egen sub-sektion øverst med
  // "Overskredet — uden for vinduet". §10b: åbne opgaver er altid Foran
  // os (isPast=false sat i dataAccess).
  const foranOsOverskredet = useMemo(
    () =>
      filtered
        .filter((r) => !r.isPast && r.outsideWindow === true)
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [filtered],
  );
  const foranOs = useMemo(
    () =>
      filtered
        .filter((r) => !r.isPast && r.outsideWindow !== true)
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [filtered],
  );
  const bagOs = useMemo(
    () =>
      filtered
        .filter((r) => r.isPast)
        .sort((a, b) => b.dateIso.localeCompare(a.dateIso)),
    [filtered],
  );

  const toggleType = (code: string) => {
    const next = new Set(activeTypes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    updateParams({
      types: next.size > 0 ? Array.from(next).join(",") : null,
    });
  };

  return (
    <LagoPullToRefresh>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-[clamp(1.375rem,1.15rem+1.1cqi,1.75rem)] font-bold tracking-tight text-[var(--fg)]">
            Aktiviteter
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-2)]">
            Foran os og bag os — planlagte besøg, events, opgaver og
            registreringer.
          </p>
        </header>

        {/* Filter-blok. På 375 px stables alle felter; på sm+ ligger de
          i to rækker. */}
        <div className="flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm">Person</Label>
              <Select
                value={person}
                onValueChange={(v) =>
                  updateParams({ person: v === defaultPerson ? null : v })
                }
              >
                <SelectTrigger className="min-h-11 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PERSONS}>Alle</SelectItem>
                  <SelectItem value={NO_OWNER}>
                    Ikke tildelt (Backoffice)
                  </SelectItem>
                  {distinctOwners.map((o) => (
                    <SelectItem key={o.salesId} value={String(o.salesId)}>
                      {o.name}
                      {actorSalesId === o.salesId && (
                        <span className="text-muted-foreground ml-1 text-sm">
                          (mig)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="akt-q" className="text-sm">
                Kunde
              </Label>
              <div className="relative">
                <Icon
                  icon={Search}
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  id="akt-q"
                  type="search"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    updateParams({ q: e.target.value || null });
                  }}
                  placeholder="Søg på kundenavn"
                  className="min-h-11 w-full min-w-0 pl-9"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm">Periode</Label>
              <Select
                value={period}
                onValueChange={(v) =>
                  updateParams({ period: v === "all" ? null : v })
                }
              >
                <SelectTrigger className="min-h-11 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alt</SelectItem>
                  <SelectItem value="week">Denne uge</SelectItem>
                  <SelectItem value="month">Denne måned</SelectItem>
                  <SelectItem value="kommende">Kommende (fra i dag)</SelectItem>
                  <SelectItem value="custom">Vælg datoer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="akt-from" className="text-sm">
                    Fra
                  </Label>
                  <Input
                    id="akt-from"
                    type="date"
                    // Guard mod at kommende-sentinel'en 9999-12-31 slipper
                    // ud i input'et hvis URL'en er manipuleret.
                    value={
                      from && from !== FAR_FUTURE_ISO ? from : startOfMonthIso()
                    }
                    onChange={(e) => updateParams({ from: e.target.value })}
                    className="min-h-11 w-full min-w-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="akt-to" className="text-sm">
                    Til
                  </Label>
                  <Input
                    id="akt-to"
                    type="date"
                    value={to && to !== FAR_FUTURE_ISO ? to : endOfMonthIso()}
                    onChange={(e) => updateParams({ to: e.target.value })}
                    className="min-h-11 w-full min-w-0"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] font-medium text-[var(--fg-2)]">
              Type:
            </span>
            {/* Brief 49 §2 (17. sep 2026): filterchip = LagoButton, ikke
              shadcn med rounded-full. Trykmål 44 px, radius 4 px. */}
            {TYPE_OPTIONS.map((t) => {
              const active = activeTypes.has(t.code);
              return (
                <LagoButton
                  key={t.code}
                  variant={active ? "primary" : "secondary"}
                  onClick={() => toggleType(t.code)}
                >
                  {t.label}
                  {active && <Icon icon={X} size="sm" />}
                </LagoButton>
              );
            })}
          </div>
        </div>

        {query.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Icon icon={Loader2} className="animate-spin" /> Henter …
          </div>
        ) : query.error ? (
          <p className="text-destructive py-4 text-sm">
            Kunne ikke hente aktiviteter. {(query.error as Error).message}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              {foranOsOverskredet.length > 0 && (
                <ActivitySection
                  title={`Overskredet — uden for vinduet (${foranOsOverskredet.length})`}
                  subtitle="Åbne opgaver med forfaldsdato før perioden — vises altid indtil de klares"
                  rows={foranOsOverskredet}
                  emptyText=""
                />
              )}
              <ActivitySection
                title={`Foran os (${foranOs.length + foranOsOverskredet.length})`}
                subtitle="Planlagte besøg, events og opgaver — det nærmeste først"
                rows={foranOs}
                emptyText="Ingen planlagte aftaler i perioden."
              />
            </div>
            <ActivitySection
              title={`Bag os (${bagOs.length})`}
              subtitle="Det, der er registreret — det seneste først"
              rows={bagOs}
              emptyText="Intet registreret i perioden. Måske er filteret for stramt."
            />
          </div>
        )}
      </div>
    </LagoPullToRefresh>
  );
}

interface ActivitySectionProps {
  title: string;
  subtitle: string;
  rows: ActivityRow[];
  emptyText: string;
}

function ActivitySection({
  title,
  subtitle,
  rows,
  emptyText,
}: ActivitySectionProps) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-bold text-[var(--fg)]">{title}</h2>
        <p className="text-[13px] text-[var(--fg-2)]">{subtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-md bg-[var(--surface-1)] p-4 text-sm text-[var(--fg-2)]">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key}>
              <ActivityCard row={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityCard({ row }: { row: ActivityRow }) {
  return (
    <article className="rounded-lg bg-[var(--surface-1)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-[var(--fg-2)]">
          <span className="font-medium text-[var(--fg)]">{row.dateLabel}</span>
          {row.timeLabel && <span>kl. {row.timeLabel}</span>}
          {/* Brief 49 §2 (17. sep 2026): type-mærkat = StatusBadge
              neutral (--r-4 = 12 px, ingen ramme, --t-meta). */}
          <StatusBadge variant="neutral">{row.typeLabel}</StatusBadge>
        </div>
        {/* Brief 54 §3 (17. sep 2026): fornavn alene i lister —
            fulde navn i title-attribut for hover. */}
        <span
          className="shrink-0 text-[13px] text-[var(--fg-2)]"
          title={row.ownerName ?? undefined}
        >
          {shortenSalesName(row.ownerName) ?? "Ikke tildelt"}
        </span>
      </div>
      <Link
        to={`/companies/${row.companyId}/show`}
        className="mt-1 block text-base font-bold text-[var(--fg)] no-underline hover:underline"
      >
        {row.companyName}
      </Link>
      {row.text && (
        <div
          className="mt-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ExpandableNote
            text={row.text}
            clampLines={3}
            className="text-sm text-[var(--fg-2)]"
          />
        </div>
      )}
    </article>
  );
}
