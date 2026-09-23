import { useQuery } from "@tanstack/react-query";
import { ArrowRight, StickyNote } from "lucide-react";
import { useState } from "react";
import { useGetIdentity } from "ra-core";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
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

interface MinDagData {
  rows: TodaysRow[];
  /** Brief 81 §5 (23. sep 2026): antal aktiviteter sælgeren har
   *  markeret som gennemført i dag. Bruges kun til tom tilstand:
   *  er der ingen planlagte tilbage OG N > 0, siger widget'en
   *  "Dagens besøg er registreret · N i dag" i stedet for "planen
   *  mangler". Samme filter som `plannedActivities` men done=true. */
  doneToday: number;
}

async function fetchTodaysVisits(mySalesId: number): Promise<MinDagData> {
  const supabase = getSupabaseClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  const todayIso = `${yyyy}-${mm}-${dd}`;

  const [plannedVisits, plannedActivities, doneTodayCount] = await Promise.all([
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
  ]);
  if (plannedVisits.error) throw plannedVisits.error;
  if (plannedActivities.error) throw plannedActivities.error;
  if (doneTodayCount.error) throw doneTodayCount.error;

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

  return {
    rows: [...visitRows, ...activityRows],
    doneToday: doneTodayCount.count ?? 0,
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
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

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
  // Brief 81 §5 (23. sep 2026): to tomme tilstande, ikke én. Ingen
  // planlagte OG ingen registreringer i dag = planen mangler (a).
  // Ingen planlagte tilbage, men N registreret = dagen er kørt (b).
  // Forskellen betyder det modsatte — (a) skubber til at planlægge,
  // (b) roser og lukker dagen.
  const dagenErKoert = count === 0 && doneToday > 0;
  return (
    <WidgetShell
      title="Hvem skal jeg besøge i dag"
      subtitle="Planlagte aftaler i tidsrækkefølge"
      seeAllHref="/companies?sort=priority"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={sorted.length === 0}
      count={
        count > 0
          ? { label: `${count} planlagte aftaler`, tone: "neutral" }
          : undefined
      }
      emptyState={
        dagenErKoert ? (
          <p>
            Dagens besøg er registreret · {doneToday}{" "}
            {doneToday === 1 ? "besøg" : "besøg"} i dag
          </p>
        ) : (
          <div className="space-y-2">
            <p>Der er ikke planlagt noget i dag.</p>
            <Link
              to="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
              className="text-[var(--fg-2)] inline-flex items-center gap-1 text-sm font-medium no-underline hover:underline"
            >
              Se hvem der trænger til besøg
              <Icon icon={ArrowRight} size="sm" />
            </Link>
          </div>
        )
      }
    >
      {/* Tillæg A §6: ingen klipning her — en planlagt dag er endelig. */}
      <ul className="flex flex-col gap-3">
        {sorted.map((row) => (
          <li key={row.company_id}>
            <VisitRow row={row} />
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

function VisitRow({ row }: { row: TodaysRow }) {
  const [regOpen, setRegOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const time = formatTime(row.next_visit_planned);
  const c = row.companies;
  const telHref = c.phone_number ? `tel:${c.phone_number}` : null;

  return (
    <article className="flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4">
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
        <div className="rounded-md bg-[var(--surface)] p-3 text-sm text-[var(--fg)]">
          <div className="mb-1 flex items-center gap-1 text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">
            <Icon icon={StickyNote} size="sm" />
            Aftale
          </div>
          <div>{row.next_visit_note}</div>
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Tillæg A §0: primær = fyldt --ink, får den plads der er tilovers. */}
        <Button
          onClick={() => setRegOpen(true)}
          className="min-h-11 flex-1 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
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
