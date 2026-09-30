import { useQuery } from "@tanstack/react-query";
import { CalendarClock, StickyNote } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Icon } from "@/lago/ui/Icon";
import { Inset } from "@/lago/ui/Inset";
import { Panel } from "@/lago/ui/Panel";
import { RowGroup } from "@/lago/ui/RowGroup";
import { PlanVisitDialog } from "@/lago/registrer/PlanVisitDialog";
import { RegistrerModal } from "@/lago/registrer/RegistrerModal";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";

/**
 * Hvem skal jeg besøge i dag (Domain-brief 34 §1 + tillæg A §0/§6,
 * udvidet brief 35 §6 · 16. sep 2026).
 *
 * To kilder til "i dag": planlagte besøg (companies_lago.next_visit_planned)
 * og planlagte aktiviteter (customer_activities_lago.done=false,
 * activity_date=today) — begge er aftaler, uanset om de hedder besøg eller
 * smagning. Merged og sorteret på tid.
 *
 * Panel-anatomi per række (--surface-1 + indstik --surface for note).
 * ÉN primær handling (Registrér), én sekundær (Ring), resten bag ⋯.
 * Ingen border. Ingen 5-klip: en planlagt dag er endelig, alt vises.
 */

type Segment = "A" | "B" | "C" | "X" | "L";

interface TodaysRow {
  company_id: number;
  /** ISO timestamp. Aktivitetskilden bruger 12:00 lokal-tid som proxy
   *  for "midt på dagen" — activity_date har ingen tidsdel. */
  next_visit_planned: string;
  next_visit_note: string | null;
  segment: Segment | null;
  companies: {
    id: number;
    name: string;
    city: string | null;
    address: string | null;
    zipcode: string | null;
    phone_number: string | null;
  };
  /** Brief 35 §6: distinguér kilden så UI'et kan vise aktivitetstypen
   *  ("Smagning") for aktivitets-rækker. Besøg viser ingen type-etiket. */
  kilde: "visit" | "activity";
  activityType?: string | null;
}

interface TomorrowRow {
  company_id: number;
  company_name: string;
  city: string | null;
  planned_iso: string;
}

interface MinDagData {
  rows: TodaysRow[];
  /** Brief 81 §5 (23. sep 2026): antal aktiviteter sælgeren har
   *  markeret som gennemført i dag. Bruges til tom tilstand som
   *  understøttende tekst under "Ikke flere besøg i dag". Samme
   *  filter som `plannedActivities` men done=true. */
  doneToday: number;
  /** Brief 85 tillæg #2 (28. sep 2026): en tom liste, der fortæller
   *  hvornår den bliver fyldt, er ikke tom. Under dagens besøg står
   *  hvad der venter i morgen — antal, byer, første tidspunkt. */
  tomorrow: TomorrowRow[];
}

async function fetchTodaysVisits(mySalesId: number): Promise<MinDagData> {
  const supabase = getSupabaseClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dayAfter = new Date(end);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  const todayIso = `${yyyy}-${mm}-${dd}`;

  const [plannedVisits, plannedActivities, doneTodayCount, tomorrowVisits] = await Promise.all([
    supabase
      .from("companies_lago")
      .select(
        "company_id, next_visit_planned, next_visit_note, segment, companies!inner(id, name, city, address, zipcode, phone_number)",
      )
      .gte("next_visit_planned", start.toISOString())
      .lt("next_visit_planned", end.toISOString())
      .eq("next_visit_planned_by", mySalesId)
      .eq("is_visible_to_sales", true)
      .eq("is_active", true)
      .order("next_visit_planned", { ascending: true }),
    // Brief 35 §6: planlagt aktivitet i dag (fx en smagning kl. 14)
    // hører til på samme liste som planlagte besøg. Filtrér på ejerskab
    // via sales_id så listen matcher "mine aftaler i dag".
    //
    // Brief 35 §6 hotfix (16. sep 2026): companies_lago må ikke indlejres
    // direkte fra customer_activities_lago — der er ingen fremmednøgle
    // den vej, og PostgREST fejler med "Could not find a relationship
    // ... in the schema cache". Går i stedet gennem companies (som HAR
    // FK til begge sider), præcis samme mønster som fetchCustomerList.
    // Se DIVERGENCE.md § "PostgREST embed-regel".
    supabase
      .from("customer_activities_lago")
      .select(
        "id, company_id, activity_date, activity_type, description, companies!inner(id, name, city, address, zipcode, phone_number, extension:companies_lago!inner(segment, is_visible_to_sales, is_active))",
      )
      .eq("activity_date", todayIso)
      .eq("done", false)
      .is("deleted_at", null)
      .eq("sales_id", mySalesId)
      .eq("companies.companies_lago.is_visible_to_sales", true)
      .eq("companies.companies_lago.is_active", true),
    // Brief 81 §5: tæller kun; ingen embed. Peter/Camilla giver 0 i dag
    // (målt 23. sep), så tom-tilstand (a) vises for dem.
    supabase
      .from("customer_activities_lago")
      .select("id", { count: "exact", head: true })
      .eq("activity_date", todayIso)
      .eq("done", true)
      .is("deleted_at", null)
      .eq("sales_id", mySalesId),
    // Brief 85 tillæg #2 (28. sep 2026): I morgen-blok — planlagte besøg
    // i morgen så sælgeren kan se hvad der venter, også når dagen er tom.
    // Kun besøg (ikke aktiviteter) — I morgen-blokken er en indikator,
    // ikke en fuld liste. Detaljer ligger på /companies?sort=priority.
    supabase
      .from("companies_lago")
      .select(
        "company_id, next_visit_planned, companies!inner(id, name, city)",
      )
      .gte("next_visit_planned", end.toISOString())
      .lt("next_visit_planned", dayAfter.toISOString())
      .eq("next_visit_planned_by", mySalesId)
      .eq("is_visible_to_sales", true)
      .eq("is_active", true)
      .order("next_visit_planned", { ascending: true }),
  ]);
  if (plannedVisits.error) throw plannedVisits.error;
  if (plannedActivities.error) throw plannedActivities.error;
  if (doneTodayCount.error) throw doneTodayCount.error;
  if (tomorrowVisits.error) throw tomorrowVisits.error;

  const visitRows: TodaysRow[] = (
    (plannedVisits.data ?? []) as unknown as Array<{
      company_id: number;
      next_visit_planned: string;
      next_visit_note: string | null;
      segment: Segment | null;
      companies: TodaysRow["companies"];
    }>
  ).map((r) => ({
    company_id: r.company_id,
    next_visit_planned: r.next_visit_planned,
    next_visit_note: r.next_visit_note,
    segment: r.segment,
    companies: r.companies,
    kilde: "visit",
  }));

  const activityRows: TodaysRow[] = (
    (plannedActivities.data ?? []) as unknown as Array<{
      company_id: number;
      activity_date: string;
      activity_type: string | null;
      description: string | null;
      companies: TodaysRow["companies"] & {
        extension:
          | { segment: Segment | null }
          | Array<{ segment: Segment | null }>
          | null;
      };
    }>
  ).map((r) => {
    // PostgREST inliner en to-many-relation som array selv når !inner
    // gør den effektivt one-to-one. Håndtér begge former for stabilitet.
    const ext = Array.isArray(r.companies.extension)
      ? r.companies.extension[0]
      : r.companies.extension;
    const { extension: _drop, ...companies } = r.companies;
    return {
      company_id: r.company_id,
      // activity_date er en date uden tid. Vi mid-dagen så tid-
      // sorteringen lander aktiviteter naturligt mellem morgen- og
      // eftermiddagsbesøg.
      next_visit_planned: `${r.activity_date}T12:00:00+00:00`,
      next_visit_note: r.description,
      segment: ext?.segment ?? null,
      companies,
      kilde: "activity",
      activityType: r.activity_type,
    };
  });

  const tomorrow: TomorrowRow[] = (
    (tomorrowVisits.data ?? []) as unknown as Array<{
      company_id: number;
      next_visit_planned: string;
      companies: { id: number; name: string; city: string | null };
    }>
  ).map((r) => ({
    company_id: r.company_id,
    company_name: r.companies.name,
    city: r.companies.city,
    planned_iso: r.next_visit_planned,
  }));

  return {
    rows: [...visitRows, ...activityRows],
    doneToday: doneTodayCount.count ?? 0,
    tomorrow,
  };
}

const timeFmt = new Intl.DateTimeFormat("da-DK", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(iso: string): string | null {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return `Kl. ${timeFmt.format(d)}`;
}

export function MinDagWidget() {
  const mySalesId = useViewSalesId();

  const query = useQuery({
    queryKey: ["lago-dashboard-min-dag", mySalesId],
    queryFn: () => fetchTodaysVisits(mySalesId!),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const rows = query.data?.rows ?? [];
  const doneToday = query.data?.doneToday ?? 0;
  const sorted = [...rows].sort((a, b) => {
    const aTime = formatTime(a.next_visit_planned);
    const bTime = formatTime(b.next_visit_planned);
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;
    return a.next_visit_planned.localeCompare(b.next_visit_planned);
  });

  const count = sorted.length;
  const tomorrow = query.data?.tomorrow ?? [];
  // Brief 87 tillæg (28. sep 2026): "Se alle kommende besøg" pegede før
  // på kundelisten (forkert destination) og på actor'ens portefølje
  // (forkert scope). Aktivitetssiden fik en "kommende"-periode så vi
  // kan pege der; person=viewSalesId sikrer at det er den kundeportefølje
  // sælgeren er i (også under dækning).
  const seeAllHref =
    mySalesId != null
      ? `/aktiviteter?types=aftale&period=kommende&person=${mySalesId}`
      : `/aktiviteter?types=aftale&period=kommende`;
  return (
    <WidgetShell
      title="Dagens besøg"
      subtitle="Planlagte aftaler i tidsrækkefølge"
      seeAllHref={seeAllHref}
      seeAllLabel="Se alle kommende besøg"
      isLoading={query.isPending}
      error={query.error as Error | null}
      count={
        count > 0
          ? { label: `${count} planlagte aftaler`, tone: "neutral" }
          : undefined
      }
      noPanel
    >
      {/* Tillæg A §6: ingen klipning her — en planlagt dag er endelig.
          Brief 85 §2 (28. sep 2026): ét Panel med RowGroup indeni.
          Brief 85 tillæg #1 (28. sep 2026): tom-tilstand ligger nu
          inde i widgetens body så "I morgen"-blokken kan stå under. */}
      {count > 0 ? (
        <Panel>
          <RowGroup>
            {sorted.map((row) => (
              <li key={row.company_id}>
                <VisitRow row={row} />
              </li>
            ))}
          </RowGroup>
        </Panel>
      ) : (
        <EmptyTodayBlock doneToday={doneToday} />
      )}
      <TomorrowBlock rows={tomorrow} />
    </WidgetShell>
  );
}

// Brief 85 tillæg #1 (28. sep 2026): "Ikke flere besøg i dag" som
// primær sætning, antal registreret som understøttende. Forskellen er
// hvad sælgeren skal bruge: ikke "du er færdig", men "der kommer ikke
// mere i dag". Antallet er hvor mange der ér registreret; nul-tallet
// tages ikke med (ingen supporting-linje hvis intet er kørt endnu).
function EmptyTodayBlock({ doneToday }: { doneToday: number }) {
  return (
    <div className="text-sm">
      <p className="text-[var(--fg)] font-medium">Ikke flere besøg i dag.</p>
      {doneToday > 0 && (
        <p className="text-[var(--fg-2)] mt-1">
          {doneToday} {doneToday === 1 ? "besøg registreret" : "besøg registreret"}{" "}
          i dag.
        </p>
      )}
    </div>
  );
}

// Brief 85 tillæg #2 (28. sep 2026): "I morgen" står under dagens
// besøg — også når dagen er tom. Kommer der noget i morgen: antal,
// byer, første tidspunkt. Kommer der ikke noget: sig det, og tilbyd
// at planlægge. Samme regel som "næste planmæssige forfald" — en tom
// liste, der fortæller hvornår den bliver fyldt, er ikke tom.
function TomorrowBlock({ rows }: { rows: TomorrowRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <p>
            <span className="text-[var(--fg-2)] font-medium">I morgen · </span>
            <span className="text-[var(--fg-3)]">Ingen planlagte besøg</span>
          </p>
          <Link
            to="/companies?sort=priority"
            className="text-[var(--fg-2)] inline-flex items-center gap-1 text-sm font-medium no-underline hover:underline"
          >
            <Icon icon={CalendarClock} size="sm" />
            Planlæg besøg
          </Link>
        </div>
      </div>
    );
  }
  const cities = Array.from(
    new Set(rows.map((r) => r.city).filter((c): c is string => !!c)),
  );
  const citiesLabel =
    cities.length === 0
      ? null
      : cities.length === 1
        ? cities[0]
        : cities.length === 2
          ? cities.join(" og ")
          : `${cities.slice(0, -1).join(", ")} og ${cities[cities.length - 1]}`;
  const firstTime = (() => {
    const first = rows[0];
    if (!first) return null;
    const t = formatTime(first.planned_iso);
    return t ? t.replace("Kl. ", "kl. ") : null;
  })();
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
      <p>
        <span className="text-[var(--fg-2)] font-medium">I morgen · </span>
        <span className="text-[var(--fg)]">
          {rows.length}{" "}
          {rows.length === 1 ? "planlagt besøg" : "planlagte besøg"}
        </span>
        {citiesLabel && (
          <span className="text-[var(--fg-2)]"> · {citiesLabel}</span>
        )}
        {firstTime && (
          <span className="text-[var(--fg-2)]">. Første {firstTime}.</span>
        )}
      </p>
    </div>
  );
}

function VisitRow({ row }: { row: TodaysRow }) {
  const [regOpen, setRegOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const time = formatTime(row.next_visit_planned);
  const c = row.companies;
  const telHref = c.phone_number ? `tel:${c.phone_number}` : null;

  return (
    <article className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {time && (
              <span className="text-[13px] font-medium text-[var(--fg-3)]">
                {time}
              </span>
            )}
            {/* Brief 35 §6: aktivitetstypen (fx "Smagning/Promotion") skal
                stå tydeligt så sælgeren kan skelne en tasting-aftale fra
                et almindeligt besøg — samme række, samme sortering. */}
            {row.kilde === "activity" && row.activityType && (
              <span className="text-[13px] font-medium text-[var(--fg-3)]">
                · {row.activityType}
              </span>
            )}
          </div>
          <Link
            to={`/companies/${c.id}/show`}
            className="block truncate text-base font-bold text-[var(--fg)] no-underline hover:underline"
          >
            {c.name}
          </Link>
          {c.city && <div className="text-sm text-[var(--fg-2)]">{c.city}</div>}
        </div>
        {row.segment && (
          <span className="shrink-0 text-[13px] font-normal text-[var(--fg-3)]">
            Segment {row.segment}
          </span>
        )}
      </div>
      {row.next_visit_note && (
        <Inset className="text-sm text-[var(--fg)]">
          <div className="mb-1 flex items-center gap-1 text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">
            <Icon icon={StickyNote} size="sm" />
            Aftale
          </div>
          <div>{row.next_visit_note}</div>
        </Inset>
      )}
      <div className="flex items-center gap-2">
        {/* Brief 85 §3 (28. sep 2026): Registrér (primær, 48px trykmål,
            uden flex-1). Ring (kun når telefon findes). Udskyd i ⋯. */}
        <Button
          onClick={() => setRegOpen(true)}
          className="min-h-12 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          Registrér
        </Button>
        {/* Sekundær: --surface-3, kun så bred som teksten. */}
        {telHref && (
          <Button
            asChild
            variant="ghost"
            className="min-h-11 shrink-0 bg-[var(--surface-3)] font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80"
          >
            <a href={telHref}>Ring</a>
          </Button>
        )}
        <RowActionsMenu
          // Brief 76 tillæg A (23. sep 2026): Udskyd = PlanVisitDialog
          // med prefill af nuværende aftale + note. Begrundelsen lander
          // i next_visit_note (overskriver forrige — kendt hul, noteret
          // i AABNE-BESLUTNINGER). next_visit_planned_by opdateres.
          // Kun for kilde=visit; aktivitet-baserede rækker (kilde
          // =activity) redigeres via aktivitet-siden, ikke her.
          actions={[
            ...(row.kilde === "visit"
              ? [
                  {
                    label: "Udskyd med begrundelse",
                    onSelect: () => setPlanOpen(true),
                  },
                ]
              : []),
            {
              label: "Åbn kunde",
              onSelect: () => {
                window.location.hash = `/companies/${c.id}/show`;
              },
            },
          ]}
        />
      </div>
      <RegistrerModal
        open={regOpen}
        onOpenChange={setRegOpen}
        companyId={c.id}
        companyName={c.name}
      />
      {row.kilde === "visit" && (
        <PlanVisitDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          companyId={c.id}
          companyName={c.name}
          segment={row.segment as "A" | "B" | "C" | "X" | "L" | null}
          currentPlannedIso={row.next_visit_planned}
          currentNote={row.next_visit_note}
        />
      )}
    </article>
  );
}
