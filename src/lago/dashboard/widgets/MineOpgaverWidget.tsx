import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClockArrowDown, Plus, Send } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { useAuthUserId } from "@/lago/portefolje/useAuthUserId";
import {
  usePortefolje,
  useViewSalesId,
} from "@/lago/portefolje/PortefoljeContext";
import { RegistrerModal } from "@/lago/registrer/RegistrerModal";
import { Icon } from "@/lago/ui/Icon";
import { IconButton } from "@/lago/ui/IconButton";
import { Panel } from "@/lago/ui/Panel";
import { RowGroup } from "@/lago/ui/RowGroup";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";
import { NyOpgaveKundePicker } from "./NyOpgaveKundePicker";
import { SendVidereDialog } from "./SendVidereDialog";
import { UdskudTaskDialog } from "./UdskudTaskDialog";

/**
 * Hvad lovede jeg sidst (Domain-brief 34 §1 + tillæg A §1/§6
 * + Brief 76 §3 · 22. sep 2026).
 *
 * Upstream tasks (public.tasks) filtreret på current user.
 * Panel-anatomi per række. Primær handling = "Markér som klaret" (sætter
 * tasks.done_date = now). Sekundær = "Åbn kunde". Bag ⋯:
 *   - Udskyd med begrundelse (FS-20, kobles i næste runde)
 *   - Send videre til kontoret
 *
 * Send videre nulstiller sales_id (så backoffice-puljen fra
 * brief 34 tillæg B overtager rækken automatisk) og appender en
 * note på tasks.text: "— Sendt til kontoret DD. mmm YYYY af N".
 * Sælgeren skal kunne SE at den er sendt videre — ikke bare at den
 * forsvinder fra hans liste (Jonas' 18. sep-bekymring). Derfor
 * vises seneste 3 sendt-videre-opgaver i en kompakt sektion nederst,
 * matched via note-teksten så vi ikke behøver en ny kolonne.
 *
 * Klippet til 5. Tællingen har rød tone hvis der er overskredne.
 */

const CLIP_TO = 5;
const HANDOFF_MARKER = "— Sendt til kontoret";

interface TaskRow {
  id: number;
  text: string | null;
  type: string | null;
  due_date: string | null;
  contact_id: number | null;
  /** Brief 85 §10 (28. sep 2026): kundens id + navn, hentet via
   *  contacts.company_id → companies.name. Alle opgaver har en
   *  kontakt og dermed en kunde — det er ikke en datamangel, det
   *  var en visningsfejl. Navnet står nu på rækken så sælgeren kan
   *  prioritere. */
  company_id: number | null;
  company_name: string | null;
}

type TaskRowFromApi = {
  id: number;
  text: string | null;
  type: string | null;
  due_date: string | null;
  contact_id: number | null;
  contacts:
    | {
        company_id: number | null;
        companies: { id: number; name: string } | null;
      }
    | Array<{
        company_id: number | null;
        companies: { id: number; name: string } | null;
      }>
    | null;
};

function mapTaskRow(r: TaskRowFromApi): TaskRow {
  // PostgREST kan returnere embed'en som array selv for one-to-one
  // relationer. Håndtér begge former for stabilitet.
  const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
  const company = contact?.companies ?? null;
  const companyObj = Array.isArray(company) ? company[0] : company;
  return {
    id: r.id,
    text: r.text,
    type: r.type,
    due_date: r.due_date,
    contact_id: r.contact_id,
    company_id: companyObj?.id ?? contact?.company_id ?? null,
    company_name: companyObj?.name ?? null,
  };
}

async function fetchMineOpgaver(salesId: number): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();
  // §14 (29. sep 2026): rullende horisont — due < i dag + 8 (7 dage frem
  // inkl. i dag), IKKE ISO-uge. Widget'et er en arbejdskø uden periode-
  // vælger og må ikke tømmes af kalenderen. En midtuge-tirsdag skulle
  // ellers vise 4 opgaver, en fredag 2, en søndag 0 — samme mennesker,
  // samme arbejde, forskellig visning. Overskredne (due_date < i dag)
  // inkluderes altid; det er en værdi der aldrig må afhænge af et vindue.
  //
  // Aktivitetssiden beholder ISO-ugen fordi den har en periodevælger.
  // Kravet fra §12 var én implementation af ugen (periodRange.ts), ikke
  // ét vindue til alle skærme. Dette var en misfortolkning af mig.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + 8);
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, text, type, due_date, contact_id, contacts(company_id, companies(id, name))",
    )
    .eq("sales_id", salesId)
    .is("done_date", null)
    .lt("due_date", cutoff.toISOString())
    .order("due_date", { ascending: true });
  if (error) throw error;
  return ((data as TaskRowFromApi[]) ?? []).map(mapTaskRow);
}

/**
 * Brief 76 §3: opgaver sælgeren har sendt videre til kontoret er stadig
 * synlige for ham. Match via note-teksten så vi ikke behøver en ny
 * kolonne — HANDOFF_MARKER er "— Sendt til kontoret" og det fulde
 * fornavn appendes så vi kan filtrere per sælger. Kun tasks der stadig
 * er åbne og uden ejer (sales_id=null) tælles med — bliver kontoret
 * færdig med dem, forsvinder de naturligt.
 */
async function fetchSendtVidere(salesFullName: string): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();
  const marker = `${HANDOFF_MARKER}%${salesFullName}`;
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, text, type, due_date, contact_id, contacts(company_id, companies(id, name))",
    )
    .is("sales_id", null)
    .is("done_date", null)
    .ilike("text", `%${marker}%`)
    .order("id", { ascending: false })
    .limit(5);
  if (error) throw error;
  return ((data as TaskRowFromApi[]) ?? []).map(mapTaskRow);
}

function formatHandoffMarker(fullName: string): string {
  const today = new Date();
  const dayMonth = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(today);
  return `\n\n${HANDOFF_MARKER} ${dayMonth} af ${fullName}`;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
});

function dueBadge(dueIso: string | null): {
  text: string;
  tone: "red" | "amber" | "neutral";
} | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due < today)
    return {
      text: `Forfaldt ${dateFmt.format(due)}`,
      tone: "red",
    };
  if (due < tomorrow) return { text: "Forfalder: I dag", tone: "amber" };
  return { text: `Forfalder: ${dateFmt.format(due)}`, tone: "neutral" };
}

export function MineOpgaverWidget() {
  const { data: identity } = useGetIdentity();
  const { viewLabel, isCovering } = usePortefolje();
  // Brief 84 §1 (28. sep 2026): to identiteter i spil.
  //   salesId (view)     = hvis opgaver læser vi (Camilla under dækning).
  //   actorSalesId + authUserId (actor) = hvem klarer opgaven (Simon).
  // completed_by_sales_id og event_af peger ALTID på actor.
  const salesId = useViewSalesId();
  const actorSalesId = useActorSalesId();
  const authUserId = useAuthUserId();
  const actorFullName =
    typeof identity?.fullName === "string" ? identity.fullName.trim() : null;
  // fullName bruges dels til "Sendt videre"-query (skal matche navnet i
  // marker-teksten, dvs. dækket person under dækning), dels til at
  // skrive nye handoff-markere (skal være actor — det er ham der
  // handoff'er nu).
  const fullName = isCovering ? viewLabel : actorFullName;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["lago-mine-opgaver", salesId],
    queryFn: () => fetchMineOpgaver(salesId!),
    enabled: salesId != null,
    staleTime: 60_000,
  });

  // Brief 76 §3: sendt-videre-listen. Fetches separat så den ikke ryger
  // ind i "åbne opfølgninger"-tællingen og lyver om overskredne.
  const sendtVidereQuery = useQuery({
    queryKey: ["lago-sendt-videre", fullName],
    queryFn: () => fetchSendtVidere(fullName!),
    enabled: !!fullName,
    staleTime: 60_000,
  });

  // Brief 42-eftersyn (16. sep 2026, pkt 3): "Markér som klaret" havde
  // ingen Fortryd. Et fejltryk på telefon lukkede en andens løfte uden
  // vej tilbage. Alt andet vi bygger (besøg, sletning, aktivitet) har
  // Fortryd — det gør denne også nu. Toast'en åbnes 5 sek; kald undo
  // ved klik = nulstil done_date. onError-toast dækker det stille tab.
  const markDone = useMutation({
    mutationFn: async (taskId: number) => {
      const supabase = getSupabaseClient();
      // Brief 84 §3 (28. sep 2026): completed_by_sales_id = actor
      // (Simon), også når han passer for Camilla. sales_id (tildelt)
      // røres ikke — opgaven bliver stående som Camillas.
      const { error } = await supabase
        .from("tasks")
        .update({
          done_date: new Date().toISOString(),
          completed_by_sales_id: actorSalesId,
        })
        .eq("id", taskId);
      if (error) throw error;
      // Brief 84 tillæg A §2: log-event til task_events_lago. Non-fatal
      // hvis det fejler — opgaven er lukket i basen uanset. event_af er
      // auth.uid() (uuid); RLS'en kræver at det matcher kalderens session.
      if (authUserId) {
        const { error: eventErr } = await supabase
          .from("task_events_lago")
          .insert({
            task_id: taskId,
            event_type: "klaret",
            event_af: authUserId,
          });
        if (eventErr) {
          console.error("Kunne ikke logge klaret-event:", eventErr);
        }
      }
      return { taskId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["lago-mine-opgaver", salesId] });
      toast.success("Opgave klaret", {
        action: {
          label: "Fortryd",
          onClick: () => {
            void (async () => {
              const supabase = getSupabaseClient();
              // Fortryd nulstiller også completed_by_sales_id, så
              // "hvem klarede den"-feltet ikke lyver efter en angerknap.
              const { error } = await supabase
                .from("tasks")
                .update({ done_date: null, completed_by_sales_id: null })
                .eq("id", result.taskId);
              if (error) {
                toast.error("Kunne ikke fortryde", {
                  description: readErrorMessage(error),
                });
                return;
              }
              // Brief 84 opfølgning C (28. sep 2026): skriv genaabnet-
              // event så loggen kan læses forfra uden at modsige
              // tilstanden. "Klaret 14:35 · genaabnet 14:35:03" — sandt
              // og fuldt. Non-fatal hvis eventen ikke lander.
              if (authUserId) {
                const { error: eventErr } = await supabase
                  .from("task_events_lago")
                  .insert({
                    task_id: result.taskId,
                    event_type: "genaabnet",
                    event_af: authUserId,
                  });
                if (eventErr) {
                  console.error("Kunne ikke logge genaabnet-event:", eventErr);
                }
              }
              qc.invalidateQueries({
                queryKey: ["lago-mine-opgaver", salesId],
              });
              toast.success("Opgaven er igen åben");
            })();
          },
        },
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke markere opgaven klaret", {
        description: readErrorMessage(err),
      }),
  });

  // Brief 76 §3 (22. sep 2026): send videre til kontoret. Nulstiller
  // sales_id (backoffice-puljen fra tillæg B til brief 34 overtager
  // automatisk) og appender note på tasks.text så både sælger og
  // kontor ved hvad der skete. Opgaven forbliver synlig i den nye
  // "Sendt til kontoret"-sektion nederst — Jonas' 18. sep-regel:
  // "en opgave, der forsvinder, er ikke delegeret. Den er tabt".
  const handoff = useMutation({
    mutationFn: async (task: TaskRow) => {
      // Handoff-markeren skriver ALTID actor-navnet: det er den, der
      // sender opgaven videre nu. Selvom Simon passer Camilla, er
      // handoff'en Simons handling.
      if (!actorFullName) throw new Error("Mangler brugerens navn");
      const supabase = getSupabaseClient();
      const currentText = task.text ?? "";
      const marker = formatHandoffMarker(actorFullName);
      const newText = currentText + marker;
      const { error } = await supabase
        .from("tasks")
        .update({ sales_id: null, text: newText })
        .eq("id", task.id);
      if (error) throw error;
      return { taskId: task.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lago-mine-opgaver", salesId] });
      qc.invalidateQueries({ queryKey: ["lago-sendt-videre", fullName] });
      toast.success("Sendt til kontoret. Backoffice ser den nu.", {
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke sende opgaven videre", {
        description: readErrorMessage(err),
      }),
  });

  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (query.data ?? []).filter(
      (t) => t.due_date && new Date(t.due_date) < today,
    ).length;
  }, [query.data]);

  const totalCount = query.data?.length ?? 0;
  const clipped = (query.data ?? []).slice(0, CLIP_TO);

  // §36 (30. sep 2026): both counts visible so the user knows what's
  // outside the window. "4 overskredet · 3 inden for 7 dage" — not
  // just overdue, which hid the upcoming ones.
  const upcomingCount = totalCount - overdueCount;
  const countParts: string[] = [];
  if (overdueCount > 0) countParts.push(`${overdueCount} overskredet`);
  if (upcomingCount > 0) countParts.push(`${upcomingCount} inden for 7 dage`);
  const countLabel =
    countParts.length > 0 ? countParts.join(" · ") : "Ingen åbne";

  // Brief 85 §16 (28. sep 2026): "Ny opgave" i widgetens header.
  // Klik åbner en kunde-vælger; når kunden er valgt, åbnes Registrér-
  // modalen på opgave-fanen for den kunde. To-trins-flow, ét ophav —
  // ingen konkurrerende task-formularer i koden.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskForCompany, setTaskForCompany] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const nyOpgaveButton =
    salesId != null ? (
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-[var(--fg-2)] inline-flex items-center gap-0.5 text-[13px] font-medium no-underline hover:underline"
      >
        <Icon icon={Plus} size="sm" />
        Ny opgave
      </button>
    ) : null;

  return (
    <WidgetShell
      title="Åbne opgaver"
      subtitle="Overskredne og opgaver med frist inden for 7 dage"
      seeAllHref="/aktiviteter?period=kommende&types=opgave"
      seeAllLabel="Se alle åbne opgaver"
      headerExtra={nyOpgaveButton}
      isLoading={query.isPending && salesId != null}
      error={query.error as Error | null}
      isEmpty={totalCount === 0}
      count={
        totalCount > 0
          ? {
              label: countLabel,
              tone: overdueCount > 0 ? "red" : "neutral",
            }
          : undefined
      }
      emptyState={
        salesId == null
          ? "Log ind for at se dine opgaver."
          : "Ingen overskredne eller kommende opgaver inden for 7 dage."
      }
      noPanel
    >
      {/* Brief 85 §2 (28. sep 2026): ét Panel med RowGroup indeni. */}
      <Panel>
        <RowGroup>
          {clipped.map((t) => (
            <li key={t.id}>
              <TaskCard
                task={t}
                onMarkDone={() => markDone.mutate(t.id)}
                onHandoff={fullName ? () => handoff.mutate(t) : null}
                handoffPending={
                  handoff.isPending && handoff.variables?.id === t.id
                }
                pending={markDone.isPending && markDone.variables === t.id}
                error={
                  markDone.isError && markDone.variables === t.id
                    ? readErrorMessage(markDone.error)
                    : null
                }
                isCovering={isCovering}
                coveredName={isCovering ? viewLabel : null}
              />
            </li>
          ))}
        </RowGroup>
      </Panel>
      {/* Brief 76 §3: sendt-videre-sektionen. Kun synlig når der ér
          noget at vise — ellers spilder vi ikke plads på "Ingen sendt
          videre" (det er normaltilstanden). */}
      {(sendtVidereQuery.data?.length ?? 0) > 0 && (
        <SendtVidereSection tasks={sendtVidereQuery.data ?? []} />
      )}
      {/* Brief 85 §16: kunde-vælger + Registrér-modal på opgave-fanen.
          Ligger som children af WidgetShell så de kan rende ved siden
          af listen uden at forstyrre layoutet — begge er overlays. */}
      <NyOpgaveKundePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(c) => setTaskForCompany(c)}
      />
      {taskForCompany && (
        <RegistrerModal
          open={!!taskForCompany}
          onOpenChange={(v) => {
            if (!v) setTaskForCompany(null);
          }}
          companyId={taskForCompany.id}
          companyName={taskForCompany.name}
          initialTab="opgave"
        />
      )}
    </WidgetShell>
  );
}

function SendtVidereSection({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-3">
      <p className="mb-2 text-[13px] font-medium text-[var(--fg-2)]">
        Sendt til kontoret
      </p>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-[13px]"
          >
            <SendtVidereRow task={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SendtVidereRow({ task }: { task: TaskRow }) {
  // Note-teksten står som "…\n\n— Sendt til kontoret DD. mmm YYYY af N".
  // Vis den originale opgave-tekst uden markeren, og datoen på egen linje.
  const raw = task.text ?? "";
  const markerIndex = raw.indexOf(HANDOFF_MARKER);
  const originalText =
    markerIndex >= 0 ? raw.slice(0, markerIndex).trim() : raw;
  const markerLine = markerIndex >= 0 ? raw.slice(markerIndex).trim() : null;
  return (
    <>
      {/* Brief 85 §10 (28. sep 2026): kundenavnet på rækken — samme
          princip som TaskCard ovenover. */}
      {task.company_name && task.company_id && (
        <Link
          to={`/companies/${task.company_id}/show`}
          className="block truncate text-[12px] font-bold text-[var(--fg-2)] no-underline hover:underline"
        >
          {task.company_name}
        </Link>
      )}
      <div className="line-clamp-2 text-[var(--fg)]">
        {originalText || "(uden tekst)"}
      </div>
      {markerLine && (
        <div className="mt-0.5 text-[12px] text-[var(--fg-3)]">
          {markerLine.replace(/^—\s*/, "")}
        </div>
      )}
    </>
  );
}

function TaskCard({
  task,
  onMarkDone,
  onHandoff,
  handoffPending,
  pending,
  error,
  isCovering,
  coveredName,
}: {
  task: TaskRow;
  onMarkDone: () => void;
  onHandoff: (() => void) | null;
  handoffPending: boolean;
  pending: boolean;
  error: string | null;
  isCovering: boolean;
  coveredName: string | null;
}) {
  const { taskTypes } = useConfigurationContext();
  const [confirming, setConfirming] = useState(false);
  const [udskudOpen, setUdskudOpen] = useState(false);
  // Brief 87 §5-hastesag (28. sep 2026): Send videre kræver bekræftelse
  // på alle bredder. Rulle-tilbagen af task 23 viste hvorfor —
  // ikonknappen fyrede uden at spørge, sælgeren gjorde intet forkert.
  // Friktion hører i handlingen, ikke i navigationen.
  const [handoffOpen, setHandoffOpen] = useState(false);
  // Brief 85 §9 (28. sep 2026): task.type = "none" er brugerens
  // eksplicitte fravalg af type. En synlig chip "Ingen" er støj —
  // etiket for "ikke-type" bidrager ikke. Skjul den.
  const typeLabel =
    task.type && task.type !== "none"
      ? (taskTypes.find((t) => t.value === task.type)?.label ?? task.type)
      : null;
  const label =
    task.text?.trim() ||
    (typeLabel ? `${typeLabel} uden tekst` : "Opgave uden tekst");
  const due = dueBadge(task.due_date);
  const dueClass =
    due?.tone === "red"
      ? "text-[var(--st-red-fg)]"
      : due?.tone === "amber"
        ? "text-[var(--st-amber-fg)]"
        : "text-[var(--fg-3)]";

  return (
    <article className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Brief 85 §10 (28. sep 2026): kundenavnet står øverst på
              rækken. Uden det kunne sælgeren ikke se, hvem opgaven hørte
              til, uden at åbne den. Klikbart link fører direkte til
              kundekortet. */}
          {task.company_name && task.company_id && (
            <Link
              to={`/companies/${task.company_id}/show`}
              className="block truncate text-[13px] font-bold text-[var(--fg-2)] no-underline hover:underline"
            >
              {task.company_name}
            </Link>
          )}
          {/* Brief 43 (16. sep 2026): line-clamp-2 — lister klipper efter
              to linjer, detaljevisningen (kundekortet) viser alt. Rækken
              kan åbnes via kundenavnet / row-linket. */}
          <div className="text-base text-[var(--fg)] whitespace-pre-wrap line-clamp-2">
            {label}
          </div>
          {typeLabel && (
            <div className="mt-1 text-[13px] font-normal text-[var(--fg-3)]">
              {typeLabel}
            </div>
          )}
        </div>
        {due && (
          <span
            className={`shrink-0 text-[13px] font-medium tabular-nums ${dueClass}`}
          >
            {due.text}
          </span>
        )}
      </div>
      {error && (
        <div className="text-[13px] text-[var(--st-red-fg)]">{error}</div>
      )}
      <div className="flex items-center gap-2">
        {/* Brief 85 §3 (28. sep 2026): Markér som klaret (primær, 48px,
            uden flex-1). Åbn kunde (kun når kontakt findes). Send
            videre / Udskyd i ⋯. */}
        <Button
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              window.setTimeout(() => setConfirming(false), 3000);
              return;
            }
            onMarkDone();
          }}
          disabled={pending}
          className="min-h-12 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          {pending
            ? "Markerer …"
            : confirming
              ? "Klik igen for at bekræfte"
              : "Markér som klaret"}
        </Button>
        {task.contact_id && (
          <Button
            asChild
            variant="ghost"
            className="min-h-11 shrink-0 bg-[var(--surface-3)] font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80"
          >
            <Link to={`/contacts/${task.contact_id}/show`}>Åbn kunde</Link>
          </Button>
        )}
        {/* Brief 87 §5 (28. sep 2026): på ≥1024 px (lg) står de to sidste
            valg som ikonknapper — Udskyd (ClockArrowDown) og Send videre
            (Send/papirflyver) — så pladsen bruges frem for at gemme dem
            bag "…". Under lg beholdes menuen, iPhone og iPad har for lidt
            plads til to knapper i træk. IconButton har 44 px trykmål og
            påkrævet aria-label; Icon er eneste indgang til Lucide.
            Brief 87 §5-hastesag (28. sep 2026 aften): Send videre åbner
            nu bekræftelse på alle bredder — både ikon og menu. Task 23
            (Ring til Paw / Rombo.dk) blev rullet tilbage manuelt fordi
            ikonknappen fyrede uden at spørge. */}
        <div className="hidden lg:flex items-center gap-2">
          <IconButton
            icon={ClockArrowDown}
            aria-label="Udskyd med begrundelse"
            title="Udskyd med begrundelse"
            onClick={() => setUdskudOpen(true)}
          />
          {onHandoff && (
            <IconButton
              icon={Send}
              aria-label="Send videre til kontoret"
              title="Send videre til kontoret"
              onClick={() => setHandoffOpen(true)}
              disabled={handoffPending}
            />
          )}
        </div>
        <div className="lg:hidden">
          <RowActionsMenu
            // Brief 76 tillæg A (23. sep 2026): Udskyd er koblet — åbner
            // UdskudTaskDialog der flytter due_date + logger begrundelsen
            // i task_events_lago (IKKE i tasks.text, som send-videre gør
            // som kendt skrøbelighed).
            // Brief 76 §3: Send videre til kontoret nulstiller sales_id
            // og appender note på tasks.text; migreres til task_events_lago
            // i en separat runde.
            // Brief 87 §5-hastesag: menu-varianten åbner også bekræftelses-
            // dialog — samme regel som ikon-varianten, samme knapper.
            actions={[
              {
                label: "Udskyd med begrundelse",
                onSelect: () => setUdskudOpen(true),
              },
              ...(onHandoff
                ? [
                    {
                      label: "Send videre til kontoret",
                      onSelect: () => setHandoffOpen(true),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
      <UdskudTaskDialog
        open={udskudOpen}
        onOpenChange={setUdskudOpen}
        taskId={task.id}
        taskLabel={label}
        currentDueDate={task.due_date}
      />
      {onHandoff && (
        <SendVidereDialog
          open={handoffOpen}
          onOpenChange={setHandoffOpen}
          taskText={label}
          companyName={task.company_name}
          isCovering={isCovering}
          coveredName={coveredName}
          pending={handoffPending}
          onConfirm={() => {
            setHandoffOpen(false);
            onHandoff();
          }}
        />
      )}
    </article>
  );
}
