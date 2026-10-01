import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { paginatedFetch } from "@/lago/ui/paginatedFetch";

/**
 * Brief 44 (16. sep 2026) — én samlet aktivitetsside.
 *
 * Tre kilder, én ActivityRow-form. Rækkerne skal se ens ud uanset
 * hvor de kommer fra (§2). Fælles klassificering "foran os" / "bag os"
 * er en ren datoberegning, ikke en anden datastruktur:
 *
 *   - customer_activities_lago (planlagte + afholdte)
 *   - companies_lago.next_visit_planned (planlagte besøg — kun én pr. kunde)
 *   - tasks (åbne + løste)
 *
 * Periode-filtrering sker server-side (mindre payload) — resten filtreres
 * client-side for at holde filtrene interaktive uden nye netværkskald.
 */

export type ActivityKind = "activity" | "visit" | "task";

export interface ActivityRow {
  key: string;
  kind: ActivityKind;
  /** ISO — enten YYYY-MM-DD (activity) eller full timestamp (visit/task). */
  dateIso: string;
  /** Formattet dato-visning ("5. nov 2026"). */
  dateLabel: string;
  /** "14:30" hvis kilden bærer klokkeslæt, ellers null. */
  timeLabel: string | null;
  /** Dansk display-navn: "Besøg" | "Smagning" | "Opkald" | "Kampagne" |
   *  "Aftale" (planlagt besøg) | "Opgave". */
  typeLabel: string;
  /** activity_type_code for filtrering (1=besøg, 2=kampagne, 4=egen,
   *  5=opkald, 10=smagning). null for visit/task-kilder — de har egne
   *  typer der filtreres separat. */
  typeCode: number | null;
  companyId: number;
  companyName: string;
  ownerName: string | null;
  ownerSalesId: number | null;
  text: string;
  /** Sat af klientsidens klassificering. §10b (29. sep 2026): åbne
   *  opgaver er altid isPast=false (Foran os), også når due_date er
   *  passeret. Kun løste og aftaler/besøg deles på dato. */
  isPast: boolean;
  /** §10c (29. sep 2026): overskreden åben opgave uden for periodefilteret.
   *  Vises altid, i egen sub-sektion øverst i "Foran os". */
  outsideWindow?: boolean;
}

export interface FetchActivitiesInput {
  /** YYYY-MM-DD (inclusive). */
  fromIso: string;
  /** YYYY-MM-DD (inclusive). */
  toIso: string;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("da-DK", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateLabel(iso: string): string {
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return dateFmt.format(d);
  } catch {
    return iso;
  }
}

function formatTimeLabel(iso: string): string | null {
  if (iso.length === 10) return null;
  try {
    const d = new Date(iso);
    if (d.getHours() === 0 && d.getMinutes() === 0) return null;
    return timeFmt.format(d);
  } catch {
    return null;
  }
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const ACTIVITY_TYPE_LABEL: Record<number, string> = {
  1: "Besøg",
  2: "Kampagne",
  4: "Egen henvendelse",
  5: "Opkald",
  10: "Smagning",
  99: "Andet",
};

export async function fetchAktivitetsside(
  input: FetchActivitiesInput,
): Promise<ActivityRow[]> {
  const supabase = getSupabaseClient();
  const today = todayIso();

  // §101-3: paginated reads for activities. Both use the same
  // pagination helper to avoid silent truncation at 1000 rows.
  const ACTIVITY_SELECT =
    "id, company_id, activity_date, activity_type_code, activity_type, description, done, sales_id, sales_name, companies!inner(name)";

  // 1a) Completed activities within the period window.
  const activityResult = await paginatedFetch<{
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    activity_type: string | null;
    description: string | null;
    done: boolean;
    sales_id: number | null;
    sales_name: string | null;
    companies: { name: string } | Array<{ name: string }>;
  }>({
    table: "customer_activities_lago",
    select: ACTIVITY_SELECT,
    filters: (q) =>
      q
        .is("deleted_at", null)
        .eq("done", true)
        .gte("activity_date", input.fromIso)
        .lte("activity_date", input.toIso)
        .order("activity_date", { ascending: false }),
  });

  // 1b) §24: open (done=false) activities — fetched WITHOUT date filter
  const openActivitiesResult = await paginatedFetch<{
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    activity_type: string | null;
    description: string | null;
    done: boolean;
    sales_id: number | null;
    sales_name: string | null;
    companies: { name: string } | Array<{ name: string }>;
  }>({
    table: "customer_activities_lago",
    select: ACTIVITY_SELECT,
    filters: (q) => q.is("deleted_at", null).eq("done", false),
  });

  // 2) Planlagte besøg via companies_lago.next_visit_planned. Én pr.
  //    kunde. Vi henter kun dem hvor datoen falder inden for perioden.
  const plannedVisitsRes = await supabase
    .from("companies_lago")
    .select(
      "company_id, next_visit_planned, next_visit_note, next_visit_planned_by, companies!inner(name)",
    )
    .not("next_visit_planned", "is", null)
    .gte("next_visit_planned", `${input.fromIso}T00:00:00`)
    .lte("next_visit_planned", `${input.toIso}T23:59:59`);
  if (plannedVisitsRes.error) throw plannedVisitsRes.error;

  // 3) Tasks. Løste filtreres på done_date i perioden.
  //    Åbne opgaver: §10c (29. sep 2026) — hentes UDEN due_date-filter
  //    så overskredne (due_date < fromIso) altid kan vises. Klienten
  //    grupperer i "i vinduet" vs "overskreden — uden for vinduet".
  //    Fremtidige opgaver (due_date > toIso) filtreres bort client-side.
  const openTasksRes = await supabase
    .from("tasks")
    .select(
      "id, text, type, due_date, sales_id, contact_id, contacts!inner(company_id, first_name, last_name, companies!inner(name))",
    )
    .is("done_date", null);
  if (openTasksRes.error) throw openTasksRes.error;

  const doneTasksRes = await supabase
    .from("tasks")
    .select(
      "id, text, type, due_date, done_date, sales_id, contact_id, contacts!inner(company_id, first_name, last_name, companies!inner(name))",
    )
    .not("done_date", "is", null)
    .gte("done_date", `${input.fromIso}T00:00:00`)
    .lte("done_date", `${input.toIso}T23:59:59`);
  if (doneTasksRes.error) throw doneTasksRes.error;

  // Slå sælgernavne op i én batch. Bruger sales-tabellen så
  // Backoffice-tildelinger (sales_id NULL) også kan mærkes klart.
  const salesIds = new Set<number>();
  for (const a of [
    ...(activityResult.rows ?? []),
    ...(openActivitiesResult.rows ?? []),
  ]) {
    if ((a as { sales_id: number | null }).sales_id != null)
      salesIds.add((a as { sales_id: number }).sales_id);
  }
  for (const v of plannedVisitsRes.data ?? []) {
    const by = (v as { next_visit_planned_by: number | null })
      .next_visit_planned_by;
    if (by != null) salesIds.add(by);
  }
  for (const t of [
    ...(openTasksRes.data ?? []),
    ...(doneTasksRes.data ?? []),
  ]) {
    if ((t as { sales_id: number | null }).sales_id != null)
      salesIds.add((t as { sales_id: number }).sales_id);
  }
  const salesNames = new Map<number, string>();
  if (salesIds.size > 0) {
    const salesRes = await supabase
      .from("sales")
      .select("id, first_name, last_name")
      .in("id", Array.from(salesIds));
    if (salesRes.error) throw salesRes.error;
    for (const s of (salesRes.data ?? []) as Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
    }>) {
      const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
      if (name) salesNames.set(s.id, name);
    }
  }

  const rows: ActivityRow[] = [];

  for (const a of (activityResult.rows ?? []) as Array<{
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    activity_type: string | null;
    description: string | null;
    done: boolean;
    sales_id: number | null;
    sales_name: string | null;
    companies: { name: string } | Array<{ name: string }>;
  }>) {
    const co = Array.isArray(a.companies) ? a.companies[0] : a.companies;
    const isPast = a.done && a.activity_date <= today;
    const ownerName =
      (a.sales_id != null ? salesNames.get(a.sales_id) : null) ??
      a.sales_name ??
      null;
    const typeLabel =
      (a.activity_type_code != null &&
        ACTIVITY_TYPE_LABEL[a.activity_type_code]) ||
      a.activity_type ||
      "Aktivitet";
    rows.push({
      key: `activity-${a.id}`,
      kind: "activity",
      dateIso: a.activity_date,
      dateLabel: formatDateLabel(a.activity_date),
      timeLabel: null,
      typeLabel,
      typeCode: a.activity_type_code,
      companyId: a.company_id,
      companyName: co?.name ?? "—",
      ownerName,
      ownerSalesId: a.sales_id,
      text: a.description ?? "",
      isPast,
    });
  }

  // §24: open activities (done=false) — overdue plans and future plans.
  // Future plans beyond toIso are filtered out. Overdue (before fromIso)
  // are always shown with outsideWindow=true — same as §10c for tasks.
  for (const a of (openActivitiesResult.rows ?? []) as Array<{
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    activity_type: string | null;
    description: string | null;
    done: boolean;
    sales_id: number | null;
    sales_name: string | null;
    companies: { name: string } | Array<{ name: string }>;
  }>) {
    const shortDate = a.activity_date.slice(0, 10);
    if (shortDate > input.toIso) continue; // future beyond window
    const co = Array.isArray(a.companies) ? a.companies[0] : a.companies;
    const ownerName =
      (a.sales_id != null ? salesNames.get(a.sales_id) : null) ??
      a.sales_name ??
      null;
    const typeLabel =
      (a.activity_type_code != null &&
        ACTIVITY_TYPE_LABEL[a.activity_type_code]) ||
      a.activity_type ||
      "Aktivitet";
    rows.push({
      key: `activity-${a.id}`,
      kind: "activity",
      dateIso: a.activity_date,
      dateLabel: formatDateLabel(a.activity_date),
      timeLabel: null,
      typeLabel,
      typeCode: a.activity_type_code,
      companyId: a.company_id,
      companyName: co?.name ?? "—",
      ownerName,
      ownerSalesId: a.sales_id,
      text: a.description ?? "",
      isPast: false,
      outsideWindow: shortDate < input.fromIso,
    });
  }

  for (const v of (plannedVisitsRes.data ?? []) as Array<{
    company_id: number;
    next_visit_planned: string;
    next_visit_note: string | null;
    next_visit_planned_by: number | null;
    companies: { name: string } | Array<{ name: string }>;
  }>) {
    const co = Array.isArray(v.companies) ? v.companies[0] : v.companies;
    const ownerName =
      v.next_visit_planned_by != null
        ? (salesNames.get(v.next_visit_planned_by) ?? null)
        : null;
    // Planlagte besøg er per definition fremtidige. isPast = false.
    rows.push({
      key: `visit-${v.company_id}`,
      kind: "visit",
      dateIso: v.next_visit_planned,
      dateLabel: formatDateLabel(v.next_visit_planned),
      timeLabel: formatTimeLabel(v.next_visit_planned),
      typeLabel: "Aftale",
      typeCode: null,
      companyId: v.company_id,
      companyName: co?.name ?? "—",
      ownerName,
      ownerSalesId: v.next_visit_planned_by,
      text: v.next_visit_note ?? "",
      isPast: false,
    });
  }

  const pushTask = (
    t: {
      id: number;
      text: string | null;
      type: string | null;
      due_date: string | null;
      done_date?: string | null;
      sales_id: number | null;
      contact_id: number;
      contacts:
        | {
            company_id: number;
            first_name: string | null;
            last_name: string | null;
            companies: { name: string } | Array<{ name: string }>;
          }
        | Array<{
            company_id: number;
            first_name: string | null;
            last_name: string | null;
            companies: { name: string } | Array<{ name: string }>;
          }>;
    },
    isDone: boolean,
  ) => {
    const contact = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
    if (!contact) return;
    const co = Array.isArray(contact.companies)
      ? contact.companies[0]
      : contact.companies;
    // For tasks: dateIso = due_date (åben) eller done_date (løst).
    // §10b (29. sep 2026): opgaver deles på STATUS, ikke dato. En åben
    // opgave hører altid til "Foran os", uanset at due_date er passeret
    // — den venter stadig på handling. Kun løste og aftaler/besøg deles
    // på dato. Historisk logik "isPast = shortDate < today" flyttede
    // overskredne åbne opgaver til "Bag os"-sektionen; det var tavst
    // forkert.
    //
    // §31c (1. okt 2026): åbne opgaver uden due_date vises med "Ingen
    // frist" — ALDRIG med now(). Forespørgselstidspunktet er ikke en
    // frist og ændrer sig ved hvert pageload.
    const hasDueDate = t.due_date != null;
    const dateIso = isDone
      ? (t.done_date ?? t.due_date ?? new Date().toISOString())
      : (t.due_date ?? null);
    // Open tasks without due_date: always show (no date filtering).
    // They belong in "Foran os" with outsideWindow=true so they appear
    // at the top, labeled "Ingen frist".
    if (!isDone && dateIso == null) {
      const ownerName =
        t.sales_id != null ? (salesNames.get(t.sales_id) ?? null) : null;
      rows.push({
        key: `task-${t.id}`,
        kind: "task",
        dateIso: "",
        dateLabel: "Ingen frist",
        timeLabel: null,
        typeLabel: "Opgave",
        typeCode: null,
        companyId: contact.company_id,
        companyName: co?.name ?? "—",
        ownerName,
        ownerSalesId: t.sales_id,
        text: t.text ?? "",
        isPast: false,
        outsideWindow: true,
      });
      return;
    }
    const effectiveDateIso = dateIso!;
    const shortDate = effectiveDateIso.slice(0, 10);
    // §10c (29. sep 2026): fremtidige åbne opgaver uden for perioden
    // filtreres bort. Overskredne (før fromIso) inkluderes altid — den
    // sektion (klient-side) mærker dem "uden for vinduet".
    if (!isDone) {
      if (shortDate > input.toIso) return; // fremtidig uden for vindue
      // shortDate < fromIso er overskreden — vises altid
    }
    const isPast = isDone; // §10b: åbne opgaver = altid Foran os
    const ownerName =
      t.sales_id != null ? (salesNames.get(t.sales_id) ?? null) : null;
    rows.push({
      key: `task-${t.id}`,
      kind: "task",
      dateIso: effectiveDateIso,
      dateLabel: hasDueDate ? formatDateLabel(effectiveDateIso) : "Ingen frist",
      timeLabel: hasDueDate ? formatTimeLabel(effectiveDateIso) : null,
      typeLabel: "Opgave",
      typeCode: null,
      companyId: contact.company_id,
      companyName: co?.name ?? "—",
      ownerName,
      ownerSalesId: t.sales_id,
      text: t.text ?? "",
      isPast,
      // §10c: markér om opgaven ligger uden for periodefilteret som
      // overskreden. Klienten viser den i en egen sub-sektion øverst.
      outsideWindow: !isDone && shortDate < input.fromIso,
    });
  };

  for (const t of (openTasksRes.data ?? []) as never[]) pushTask(t, false);
  for (const t of (doneTasksRes.data ?? []) as never[]) pushTask(t, true);

  return rows;
}
