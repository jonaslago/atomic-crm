import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  CompanyCore,
  CompanyLagoExtension,
  CompanyNote,
  ContactSummary,
  CustomerActivity,
  LagoCustomerData,
  OpenTask,
  SaveExtensionInput,
} from "./types";
import type { ServerVisitPriority } from "./priority";

// Fetches everything the LAGO customer page needs for one company.
// Each query is small and indexed; PostgREST keeps round-trips down.
// Errors are surfaced — the caller decides what to show.

export async function fetchLagoCustomer(
  companyId: number,
): Promise<LagoCustomerData> {
  const supabase = getSupabaseClient();
  const [
    companyRes,
    extensionRes,
    contactsRes,
    notesRes,
    activitiesRes,
    priorityRes,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, sector, size, website, linkedin_url, phone_number, address, zipcode, city, country, tax_identifier, revenue, description, sales_id",
      )
      .eq("id", companyId)
      .single<CompanyCore>(),
    supabase
      .from("companies_lago")
      .select(
        "company_id, visma_customer_no, segment, last_visit_at, next_visit_planned, next_visit_note, opening_hours, faktura_email, debitorinfo, distrikt, betaling, visma_sales_code, visma_sales_name, kundestatus, visma_statuskode, is_active, last_visma_import_at, besoegsfrekvens_dage, besoegsfrekvens_note, besoegsfrekvens_sat_af, besoegsfrekvens_sat, kreditspaerre, saesonlukket_fra, saesonlukket_til, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .maybeSingle<CompanyLagoExtension>(),
    supabase
      .from("contacts")
      .select(
        // Brief 29 §2: hent is_webshop_user fra contacts_lago så
        // kontakt-kortet kan vise "Webshop-bruger — adgang styres i
        // VISMA"-mærkatet. LEFT join så CRM-native kontakter uden
        // lago-sidecar stadig kommer med (is_webshop_user = null).
        "id, first_name, last_name, title, status, email_jsonb, phone_jsonb, extension:contacts_lago(is_webshop_user)",
      )
      .eq("company_id", companyId)
      .order("last_name", { ascending: true }),
    supabase
      .from("company_notes_lago")
      .select("id, company_id, contact_id, text, sales_id, created_at")
      .eq("company_id", companyId)
      // Sletteregler (29. sep 2026): skjul blødt slettede noter fra
      // visningen. sletninger_lago-triggeren fanger overgangen, så
      // rækken har fortsat spor i loggen.
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<CompanyNote[]>(),
    supabase
      .from("customer_activities_lago")
      .select(
        "id, company_id, activity_date, activity_type_code, activity_type, description, sales_name, sales_id, done, source",
      )
      .eq("company_id", companyId)
      // Brief 16. sep 2026: skjul blødt slettede aktiviteter fra
      // visningen. Data er stadig i databasen (fortrydes via undo);
      // filteret er kun UI-side. Server håndhæver at kun ejer/admin
      // kan sætte deleted_at via RPC.
      .is("deleted_at", null)
      .order("activity_date", { ascending: false })
      .limit(50)
      .returns<CustomerActivity[]>(),
    // Brief 64 fase 2 (18. sep 2026): serverberegnet grundstatus. Én
    // enkelt række fra view'et — samme regelsæt som listen bruger, så
    // Preview og listen viser præcis samme prik.
    supabase
      .from("customers_with_priority_lago")
      .select("status, days_overdue, interval_days, days_since_visit")
      .eq("company_id", companyId)
      .maybeSingle<{
        status: ServerVisitPriority["status"];
        days_overdue: number | null;
        interval_days: number;
        days_since_visit: number | null;
      }>(),
  ]);

  if (companyRes.error) throw companyRes.error;
  if (extensionRes.error) throw extensionRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (notesRes.error) throw notesRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (priorityRes.error) throw priorityRes.error;

  const contactIds = (contactsRes.data ?? []).map((c) => c.id);

  let openTasks: OpenTask[] = [];
  if (contactIds.length > 0) {
    const tasksRes = await supabase
      .from("tasks")
      .select("id, text, due_date, type, contact_id, sales_id")
      .in("contact_id", contactIds)
      .is("done_date", null)
      .order("due_date", { ascending: true })
      .limit(20)
      .returns<OpenTask[]>();
    if (tasksRes.error) throw tasksRes.error;
    openTasks = tasksRes.data ?? [];
  }

  // Brief 29 §2: fladt is_webshop_user ud fra det embedded contacts_lago-
  // objekt så ContactSummary bevarer sit simple shape og UI ikke skal
  // navigere en ekstension-node på hver kontakt.
  const contacts = (contactsRes.data ?? []).map((c: any) => {
    const ext = Array.isArray(c.extension) ? c.extension[0] : c.extension;
    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      title: c.title,
      status: c.status,
      email_jsonb: c.email_jsonb,
      phone_jsonb: c.phone_jsonb,
      is_webshop_user: ext?.is_webshop_user ?? null,
    } as ContactSummary;
  });

  return {
    company: companyRes.data,
    extension: extensionRes.data ?? null,
    contacts,
    openTasks,
    notes: notesRes.data ?? [],
    activities: activitiesRes.data ?? [],
    visitPriority: priorityRes.data ?? null,
  };
}

export interface CreateCompanyNoteInput {
  company_id: number;
  text: string;
  contact_id?: number | null;
  sales_id?: number | null;
}

export async function createCompanyNote(
  input: CreateCompanyNoteInput,
): Promise<{ id: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("company_notes_lago")
    .insert({
      company_id: input.company_id,
      contact_id: input.contact_id ?? null,
      text: input.text,
      sales_id: input.sales_id ?? null,
    })
    .select("id")
    .single<{ id: number }>();
  if (error) throw error;
  return data;
}

// Brief 40 tillæg B (16. sep 2026): Fortryd-mønsteret kræver at
// klienten kender id'et på det, der lige blev gemt. Bruges af
// QuickNoteForm efter oprettelse.
// Sletteregler (29. sep 2026): hård delete bevares KUN til
// "fortryd lige-oprettet"-flow (samme transaction-scope, ingen loghul).
// Almindelig sletning fra kundekortet bruger soft_delete_note-RPC'en,
// som fyrer sletninger_lago-triggeren.
export async function deleteCompanyNote(id: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("company_notes_lago")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Sletteregler (29. sep 2026) · soft-delete og fortryd af noter.
// Trigger på deleted_at skriver til sletninger_lago; RPC bærer
// begrundelsen ind via SET LOCAL.

export async function softDeleteNote(
  id: number,
  begrundelse: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("soft_delete_note", {
    p_id: id,
    p_begrundelse: begrundelse ?? null,
  });
  if (error) throw error;
}

export async function restoreNote(id: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("restore_note", { p_id: id });
  if (error) throw error;
}

export async function updateNote(
  id: number,
  text: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("company_notes_lago")
    .update({ text })
    .eq("id", id);
  if (error) throw error;
}

export interface CreateTaskInput {
  contact_id: number;
  text: string;
  /** ISO-string. Nullable — tasks-tabellen tillader det, og AI-forslag
   *  uden en angivet dato må gerne lande som "no due date". */
  due_date: string | null;
  type?: string | null;
  sales_id?: number | null;
}

export async function createTask(
  input: CreateTaskInput,
): Promise<{ id: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      contact_id: input.contact_id,
      text: input.text,
      due_date: input.due_date ?? null,
      type: input.type ?? null,
      sales_id: input.sales_id ?? null,
      // Brief 43-gæld (16. sep 2026): eksplicit oprindelse.
      // QuickTaskForm (kundekortets preview-panel) er en manuel
      // registrering — samme markør som FollowUpBuilder bruger.
      // NULL på origin ville gøre målingen tvetydig når vi senere
      // spørger "af de N tasks, hvor mange var manuelle?".
      origin: "manual",
    })
    .select("id")
    .single<{ id: number }>();
  if (error) throw error;
  return data;
}

// Brief 40 tillæg B: Fortryd på QuickTaskForm bruger en direct DELETE
// på tasks-rækken. Hard delete er OK for opgaver (i modsætning til
// customer_activities_lago, hvor soft-delete beskytter mod at tabe
// last_visit_at-koblingen).
export async function deleteTask(id: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export interface CustomerListRow {
  id: number;
  name: string;
  sales_id: number | null;
  city: string | null;
  sector: string | null;
  /** Brief 85 §3b (28. sep 2026): kundens hovedtelefon fra companies.
   *  Bruges til Ring-knap på Trænger-widget'ens rækker. */
  phone_number: string | null;
  extension: {
    visma_customer_no: string | null;
    /** Brief 13: A/B/C/X/L. */
    segment: "A" | "B" | "C" | "X" | "L" | null;
    last_visit_at: string | null;
    /** Brief 14: fremtidig aftale → planlagt-markering på pin + i lister. */
    next_visit_planned: string | null;
    /** Brief 15: valgfri "hvad vil jeg"-note på den planlagte booking. */
    next_visit_note: string | null;
    distrikt: string | null;
    visma_sales_code: string | null;
    visma_sales_name: string | null;
    /** Brief 13: droppet — se CompanyLagoExtension. */
    kundestatus: string | null;
    is_active: boolean;
    /** Brief 58 §2b (17. sep 2026): branche-filter i kundelistens skinne
     *  bruger branche_kode + brancher_lago-opslag. NULL = ikke mappet. */
    branche_kode: number | null;
    /** Brief 65 (18. sep 2026): "hvorfor" til override-frekvens. NULL = ingen
     *  note (uanset om override er sat eller ej). Vises i preview-panelet. */
    besoegsfrekvens_note: string | null;
    /** Brief 68 (21. sep 2026): VISMA kreditspærre-flag. Vises som rød
     *  "Kreditspærret"-chip i preview + kortets ark, ikke på selve
     *  liste-rækken (den har allerede fem signaler pr. række). */
    kreditspaerre: boolean | null;
  } | null;
  /**
   * Brief 35 §5 (16. sep 2026): tidligste fremtidige aftale på kunden,
   * uanset kilde. Enten `extension.next_visit_planned` eller den
   * tidligste `customer_activities_lago`-række med `done=false` og
   * `activity_date >= today`. Bruges til kundelistens planlagt-markering
   * så en smagning på fredag giver samme visuelle signal som et planlagt
   * besøg — briefen siger eksplicit: genbrug markeringen, opfind ikke en
   * ny farve.
   */
  next_planned_at: string | null;
  /**
   * Brief 64 fase 2 (18. sep 2026): serverberegnet grundstatus for
   * kunden fra public.customers_with_priority_lago. NULL når view'et
   * ikke returnerede en række for kunden (fx en admin-only kunde
   * uden companies_lago-række, som view'et joiner på). Læsere kalder
   * `priorityFromServer(row.visit_priority)` og undgår at gentage
   * computeVisitPriority klient-side.
   */
  visit_priority: ServerVisitPriority | null;
}

/**
 * Read every company + its LAGO extension in a single embedded query so the
 * sælger-kundeliste can compute priority client-side. Filtering by sales_id
 * happens server-side when "mine kunder" is on.
 *
 * Brief 26 §2 (rev. 16. sep 2026): sælgerskærme ser KUN kunder med
 * companies_lago.is_visible_to_sales=true — nu KUN distrikt-baseret
 * (Øst/Vest/HQ). Absolut, kan ikke slås fra. Aktiv/inaktiv er en
 * STANDARD, ikke en del af synligheden: LagoCustomerList's Vis
 * inaktive-toggle løfter client-side-filteret på is_active.
 *
 * Vi bruger !inner-join, så en kunde uden companies_lago-række også
 * bliver usynlig — det er det rigtige, fordi is_visible_to_sales ikke
 * kan evalueres uden extension-rækken. Admin kan bede om includeHidden.
 */
/** Brief 55 §2 (17. sep 2026): kundelisten kan bede om count ved siden
 *  af rækkerne — så en tavs PostgREST-afkortning bliver til en synlig
 *  advarsel. Alle andre callers (widgets, felt-siden) bruger det gamle
 *  array-returtype uændret.
 *
 *  Hotfix (17. sep 2026 middag): fetchCustomerList returnerede pludselig
 *  et {rows, total, truncated}-objekt, og 10 kaldesteder (Ringeliste,
 *  Trænger, MinUgeStatus, HvadSkalJegGoereNu, MinStatus, NeedsVisitTop5,
 *  FeltShell, felt/kort/dataAccess, felt/dataAccess) faldt over
 *  `data.map is not a function`. Returtypen er nu igen et array;
 *  count-varianten hedder fetchCustomerListWithCount og bruges kun af
 *  LagoCustomerList. */
export interface CustomerListPage {
  rows: CustomerListRow[];
  total: number;
  truncated: boolean;
}

export interface FetchCustomerListOpts {
  mySalesId?: number | null;
  onlyMine?: boolean;
  /** Brief 26 §6: admin-flag der bypasser sælger-synlighedsfilteret.
   *  Default false — alle sælgerskærme lader det være. */
  includeHidden?: boolean;
  /** Brief 26 §2 (rev. 16. sep 2026): status er en STANDARD, ikke
   *  en del af synligheden. Default false = kun aktive. True = tag
   *  inaktive kunder med (Vis inaktive-toggle). Client-side filter
   *  i LagoCustomerList giver backup, men server-siden trimmer først
   *  af skalerings-hensyn. */
  includeInactive?: boolean;
}

/**
 * Brief 55 tillæg A (17. sep 2026, aften): fetchCustomerList må IKKE
 * kalde fetchCustomerListWithCount — det tvinger `count: "exact"` på
 * ALLE 10 kaldere (widgets, felt), som på iPhone-netværk timeout'er.
 * Ringelisten fejlede kun på mobil af den grund. Standard-versionen
 * beholder sin gamle hurtige query; count-versionen bruges KUN af
 * LagoCustomerList hvor tælleren skal vises.
 */
export async function fetchCustomerList(
  opts: FetchCustomerListOpts,
): Promise<CustomerListRow[]> {
  return runCustomerListQuery(opts, false).then((r) => r.rows);
}

export async function fetchCustomerListWithCount(
  opts: FetchCustomerListOpts,
): Promise<CustomerListPage> {
  return runCustomerListQuery(opts, true);
}

async function runCustomerListQuery(
  opts: FetchCustomerListOpts,
  withCount: boolean,
): Promise<CustomerListPage> {
  const supabase = getSupabaseClient();
  // Brief 55 §2: range 0-4999 er en høj bagside; count: 'exact' henter
  // det faktiske antal rækker der matcher filtrene. Sammenligning i UI
  // afgør om afkortning skal siges højt. `count: 'exact'` er DYRT på
  // langsomme forbindelser — kun kundelisten beder om det.
  const MAX_ROWS = 5000;
  const selectOpts = withCount ? { count: "exact" as const } : undefined;
  let q = supabase
    .from("companies")
    .select(
      // Brief 85 §3b (28. sep 2026): phone_number er tilføjet — Ring-
      // knappen på Trænger-widget'ens rækker skal kunne bygge tel:
      // href'en direkte. Kolonnen findes allerede i companies.
      "id, name, sales_id, city, sector, phone_number, extension:companies_lago!inner(visma_customer_no, segment, last_visit_at, next_visit_planned, next_visit_note, distrikt, visma_sales_code, visma_sales_name, kundestatus, is_active, is_visible_to_sales, branche_kode, besoegsfrekvens_note, kreditspaerre)",
      selectOpts,
    )
    .order("name", { ascending: true })
    .range(0, MAX_ROWS - 1);

  if (!opts.includeHidden) {
    // Distrikt-synlighed er absolut — sælgerskærme ser aldrig Intern
    // eller Eksport. Ét sted, ét flag.
    q = q.eq("companies_lago.is_visible_to_sales", true);
  }

  if (!opts.includeInactive && !opts.includeHidden) {
    // Aktive-standard: default skjules status 9/99/0. Vis inaktive
    // løfter det — men admin (includeHidden) ser i forvejen alt.
    q = q.eq("companies_lago.is_active", true);
  }

  if (opts.onlyMine && typeof opts.mySalesId === "number") {
    q = q.eq("sales_id", opts.mySalesId);
  }

  const { data, error, count } = await q;
  if (error) throw error;
  const total = count ?? (data?.length ?? 0);

  const baseRows = (data ?? []).map((row: any) => {
    const rawExt = Array.isArray(row.extension)
      ? row.extension[0]
      : row.extension;
    return {
      id: row.id as number,
      name: row.name as string,
      sales_id: row.sales_id ?? null,
      city: row.city ?? null,
      sector: row.sector ?? null,
      phone_number: row.phone_number ?? null,
      extension: rawExt
        ? {
            visma_customer_no: rawExt.visma_customer_no ?? null,
            segment: rawExt.segment ?? null,
            last_visit_at: rawExt.last_visit_at ?? null,
            next_visit_planned: rawExt.next_visit_planned ?? null,
            next_visit_note: rawExt.next_visit_note ?? null,
            distrikt: rawExt.distrikt ?? null,
            visma_sales_code: rawExt.visma_sales_code ?? null,
            visma_sales_name: rawExt.visma_sales_name ?? null,
            kundestatus: rawExt.kundestatus ?? null,
            is_active: rawExt.is_active !== false,
            branche_kode: rawExt.branche_kode ?? null,
            besoegsfrekvens_note: rawExt.besoegsfrekvens_note ?? null,
            kreditspaerre: rawExt.kreditspaerre ?? null,
          }
        : null,
    };
  });

  // Brief 35 §5 (16. sep 2026): berig med tidligste fremtidige planlagte
  // aktivitet pr. kunde, så CustomerRow kan vise samme planlagt-markering
  // uanset om det er et besøg eller en smagning. Én batch-query — vi
  // ekskluderer besøgs-typen (kode 1), fordi et fremtidigt besøg findes
  // via `next_visit_planned` (og fanget i UI'et i forvejen). Aktivitets-
  // tabellen er ~10 kk rows i alt, så simpel `IN (companyIds)` er hurtig.
  const companyIds = baseRows.map((r) => r.id);
  const todayIsoDate = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const nextPlannedByCompany = new Map<number, string>();
  if (companyIds.length > 0) {
    const actRes = await supabase
      .from("customer_activities_lago")
      .select("company_id, activity_date")
      .in("company_id", companyIds)
      .eq("done", false)
      .is("deleted_at", null)
      .neq("activity_type_code", 1)
      .gte("activity_date", todayIsoDate)
      .order("activity_date", { ascending: true });
    if (actRes.error) throw actRes.error;
    for (const row of (actRes.data ?? []) as Array<{
      company_id: number;
      activity_date: string;
    }>) {
      // .order sikrer at første forekomst pr. company_id er den tidligste
      if (!nextPlannedByCompany.has(row.company_id)) {
        nextPlannedByCompany.set(row.company_id, row.activity_date);
      }
    }
  }

  // Brief 64 fase 2 (18. sep 2026): serverberegnet grundstatus fra
  // customers_with_priority_lago. Én batch-query på samme companyIds
  // som ovenfor. View'et joiner på companies_lago, så kunder uden
  // extension (ikke synlige for sælgere) mangler også her — mappen
  // giver simpelthen null, og læserne falder tilbage til
  // computeVisitPriority indtil fase 3 sletter det. Under normal
  // sælger-drift (is_visible_to_sales=true) har alle rækker en
  // priority.
  const priorityByCompany = new Map<number, ServerVisitPriority>();
  if (companyIds.length > 0) {
    const priRes = await supabase
      .from("customers_with_priority_lago")
      .select("company_id, status, days_overdue, interval_days, days_since_visit")
      .in("company_id", companyIds);
    if (priRes.error) throw priRes.error;
    for (const row of (priRes.data ?? []) as Array<{
      company_id: number;
      status: ServerVisitPriority["status"];
      days_overdue: number | null;
      interval_days: number;
      days_since_visit: number | null;
    }>) {
      priorityByCompany.set(row.company_id, {
        status: row.status,
        days_overdue: row.days_overdue,
        interval_days: row.interval_days,
        days_since_visit: row.days_since_visit,
      });
    }
  }

  const rows = baseRows.map((row) => {
    const plannedVisitIso = row.extension?.next_visit_planned ?? null;
    const plannedActivityIso = nextPlannedByCompany.get(row.id) ?? null;
    // Sammenlign som strenge — begge er ISO-format og sorterer korrekt
    // leksikografisk. Null-siden er "ingen aftale af den type".
    const nextPlannedAt =
      plannedVisitIso && plannedActivityIso
        ? plannedVisitIso < plannedActivityIso
          ? plannedVisitIso
          : plannedActivityIso
        : (plannedVisitIso ?? plannedActivityIso);
    return {
      ...row,
      next_planned_at: nextPlannedAt,
      visit_priority: priorityByCompany.get(row.id) ?? null,
    };
  });
  return { rows, total, truncated: rows.length < total };
}

// ---------------------------------------------------------------------
// Brief 65 (18. sep 2026) · Besøgsfrekvens-override
// ---------------------------------------------------------------------

export interface SaveBesoegsfrekvensInput {
  company_id: number;
  /** NULL = brug segmentets standard. 7-365 når sat. */
  besoegsfrekvens_dage: number | null;
  /** "Hvorfor". Kan være null (valgfri). Ryddes hvis dage sættes til NULL. */
  besoegsfrekvens_note: string | null;
  /** Hvem valgte — sales.id på den indloggede. */
  sales_id_setter: number;
}

/**
 * Brief 65 §5: "Brug standarden" sletter både frekvens OG note. Reglen er
 * absolut — noten uden frekvens er meningsløs, den forklarer et valg der
 * ikke længere findes. Sat_af + sat nulstilles med, ellers ville metadata
 * peger på en beslutning der ikke længere gælder.
 */
export async function saveBesoegsfrekvens(
  input: SaveBesoegsfrekvensInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const dage = input.besoegsfrekvens_dage;
  const isReset = dage === null;
  const patch = {
    besoegsfrekvens_dage: dage,
    besoegsfrekvens_note: isReset ? null : (input.besoegsfrekvens_note ?? null),
    besoegsfrekvens_sat_af: isReset ? null : input.sales_id_setter,
    besoegsfrekvens_sat: isReset ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("companies_lago")
    .update(patch)
    .eq("company_id", input.company_id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Brief 90 §2 (28. sep 2026) · Ringeliste luk-med-begrundelse
// ---------------------------------------------------------------------

export interface CreateRingelisteLukningInput {
  company_id: number;
  begrundelse: string;
  /** Kopier fra kundens nuværende extension så auto-luk-reglen kan
   *  sammenligne. Kaldes typisk med extension.last_visit_at og priority
   *  .days_overdue fra samme række som lukkes. */
  last_visit_at_ved_lukning: string | null;
  days_overdue_ved_lukning: number | null;
  /** Aktørens sales.id (Simon under normalt flow, Jonas under dækning). */
  lukket_af: number | null;
}

/**
 * Brief 90 §2: opret en ringeliste-lukning. Auto-luk-view'et står for
 * gyldighedstjek — vi gemmer bare snapshottet af hvad der var kendt
 * ved lukketidspunktet, så view'et kan sammenligne senere.
 */
export async function createRingelisteLukning(
  input: CreateRingelisteLukningInput,
): Promise<{ id: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ringeliste_lukninger_lago")
    .insert({
      company_id: input.company_id,
      begrundelse: input.begrundelse,
      last_visit_at_ved_lukning: input.last_visit_at_ved_lukning,
      days_overdue_ved_lukning: input.days_overdue_ved_lukning,
      lukket_af: input.lukket_af,
    })
    .select("id")
    .single<{ id: number }>();
  if (error) throw error;
  return data;
}

/** Hent alle aktive lukninger — bruges til at filtrere kundelistens
 *  ringeliste-radio. Auto-luk-view'et gør al gyldighedslogikken. */
export async function fetchActiveRingelisteLukninger(): Promise<
  Array<{ company_id: number; lukket_at: string; begrundelse: string }>
> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("v_active_ringeliste_lukninger_lago")
    .select("company_id, lukket_at, begrundelse");
  if (error) throw error;
  return (data ?? []) as Array<{
    company_id: number;
    lukket_at: string;
    begrundelse: string;
  }>;
}

// ---------------------------------------------------------------------
// Brief 90 §3 (28. sep 2026) · Sæsonlukket-periode
// ---------------------------------------------------------------------

export interface SaveSaesonlukketInput {
  company_id: number;
  /** ISO-dato (YYYY-MM-DD). NULL = ryd sæsonlukning. Skal parres med til. */
  saesonlukket_fra: string | null;
  saesonlukket_til: string | null;
}

/**
 * Brief 90 §3: sæsonlukket er en periode, ikke et flueben. Rykker to
 * datoer på companies_lago; view'et gør resten (uret må ikke nulstilles,
 * så last_visit_at røres ikke). Send NULL/NULL for at rydde.
 */
export async function saveSaesonlukket(
  input: SaveSaesonlukketInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("companies_lago")
    .update({
      saesonlukket_fra: input.saesonlukket_fra,
      saesonlukket_til: input.saesonlukket_til,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", input.company_id);
  if (error) throw error;
}

export async function upsertLagoExtension(
  input: SaveExtensionInput,
): Promise<CompanyLagoExtension> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies_lago")
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" },
    )
    .select(
      "company_id, visma_customer_no, segment, last_visit_at, next_visit_planned, next_visit_note, opening_hours, created_at, updated_at",
    )
    .single<CompanyLagoExtension>();

  if (error) throw error;
  return data;
}
