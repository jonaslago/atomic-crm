import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";

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
}

async function fetchMineOpgaver(salesId: number): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + 8); // 7 dage frem
  const { data, error } = await supabase
    .from("tasks")
    .select("id, text, type, due_date, contact_id")
    .eq("sales_id", salesId)
    .is("done_date", null)
    .lt("due_date", cutoff.toISOString())
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]) ?? [];
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
    .select("id, text, type, due_date, contact_id")
    .is("sales_id", null)
    .is("done_date", null)
    .ilike("text", `%${marker}%`)
    .order("id", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data as TaskRow[]) ?? [];
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
  const salesId = typeof identity?.id === "number" ? identity.id : null;
  const fullName =
    typeof identity?.fullName === "string" ? identity.fullName.trim() : null;
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
      const { error } = await supabase
        .from("tasks")
        .update({ done_date: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
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
              const { error } = await supabase
                .from("tasks")
                .update({ done_date: null })
                .eq("id", result.taskId);
              if (error) {
                toast.error("Kunne ikke fortryde", {
                  description: readErrorMessage(error),
                });
                return;
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
      if (!fullName) throw new Error("Mangler brugerens navn");
      const supabase = getSupabaseClient();
      const currentText = task.text ?? "";
      const marker = formatHandoffMarker(fullName);
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

  const countLabel =
    overdueCount > 0
      ? `${overdueCount} overskredet · ${totalCount} åbne`
      : totalCount > 0
        ? `${totalCount} åbne`
        : "Ingen åbne";

  return (
    <WidgetShell
      title="Hvad lovede jeg sidst"
      subtitle="Åbne opfølgninger fra tidligere besøg"
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
          : "Ingen åbne opfølgninger de næste 7 dage."
      }
    >
      <ul className="flex flex-col gap-3">
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
            />
          </li>
        ))}
      </ul>
      {/* Brief 76 §3: sendt-videre-sektionen. Kun synlig når der ér
          noget at vise — ellers spilder vi ikke plads på "Ingen sendt
          videre" (det er normaltilstanden). */}
      {(sendtVidereQuery.data?.length ?? 0) > 0 && (
        <SendtVidereSection tasks={sendtVidereQuery.data ?? []} />
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
      <div className="line-clamp-2 text-[var(--fg)]">
        {originalText || "(uden tekst)"}
      </div>
      {markerLine && (
        <div className="mt-0.5 text-[12px] text-[var(--fg-3)]">
          {markerLine.replace(/^—\s*/, "")}
        </div>
      )}
      {task.contact_id && (
        <Link
          to={`/contacts/${task.contact_id}/show`}
          className="mt-1 inline-block text-[12px] font-medium text-[var(--fg-2)] no-underline hover:underline"
        >
          Åbn kunde →
        </Link>
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
}: {
  task: TaskRow;
  onMarkDone: () => void;
  onHandoff: (() => void) | null;
  handoffPending: boolean;
  pending: boolean;
  error: string | null;
}) {
  const { taskTypes } = useConfigurationContext();
  const [confirming, setConfirming] = useState(false);
  const typeLabel = task.type
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
    <article className="flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
        {/* Primær: Markér som klaret. */}
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
          className="min-h-11 flex-1 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
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
        <RowActionsMenu
          // Brief 36: Udskyd (FS-20) kobles i næste runde.
          // Brief 76 §3 (22. sep 2026): Send videre til kontoret er nu
          // her — den nulstiller sales_id og appender en note på
          // tasks.text, så backoffice-puljen overtager og sælgeren
          // stadig kan se den i "Sendt til kontoret"-sektionen nederst.
          actions={
            onHandoff
              ? [
                  {
                    label: handoffPending
                      ? "Sender …"
                      : "Send videre til kontoret",
                    onSelect: onHandoff,
                  },
                ]
              : []
          }
        />
      </div>
    </article>
  );
}
