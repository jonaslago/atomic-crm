import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { useAuthUserId } from "@/lago/portefolje/useAuthUserId";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Button as LagoButton } from "@/lago/ui/Button";
import { Panel } from "@/lago/ui/Panel";
import { readErrorMessage } from "@/lago/ui/errorMessage";

import { WidgetShell } from "../WidgetShell";
import { CompactTaskRow } from "./CompactTaskRow";

/**
 * Åbne opgaver — kontor/admin-varianten (Domain-brief 18 §4.2,
 * rev. brief 34 tillæg B 16. sep 2026, rev. brief 90 §5 28. sep 2026).
 *
 * Widget'en hed før "Opfølgninger fra sælgerne". Simon opretter også
 * sine egne — så titlen matcher nu sælgerens ("Åbne opgaver"), og
 * oprindelsen (fra hvem, hvornår) står på rækken. Jonas' brief 90 §5:
 * "enhver, der kan modtage noget, skal kunne lukke det" — derfor har
 * kontor-widget'en nu samme Markér-som-klaret-knap som sælgerens.
 *
 * Data: tasks hvor sales_id IS NULL (Backoffice-kø) eller sales_id
 * peger på en kontor-bruger. Ingen early-return hvis kontor-listen er
 * tom — Backoffice-opgaver skal stadig vises.
 *
 * Oprindelse (brief 90 §5): udledes af tekstens HANDOFF_MARKER, som
 * MineOpgaverWidget skriver på sælger-siden ved "Send til kontoret":
 * "— Sendt til kontoret DD. mmm YYYY af N". Findes markeren, står der
 * "Fra N, DD. mmm" på rækken. Ellers "Egen" hvis assign matcher actor,
 * "Ikke tildelt" hvis assign er null uden marker.
 *
 * markDone-mønsteret er identisk med MineOpgaverWidget (brief 42-
 * eftersyn + brief 84 §3): completed_by_sales_id = actor, task_events_lago
 * logger klaret/genaabnet, toast med Fortryd i 5 sek.
 */

interface OpfoelgningRow {
  id: number;
  text: string | null;
  type: string | null;
  due_date: string | null;
  contact_id: number | null;
  sales_id: number | null;
  sales: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const CLIP_TO = 5;
const HANDOFF_MARKER = "— Sendt til kontoret";

// §31b: excludeMySalesId filters out the viewer's own tasks so they
// don't duplicate with "Mine opgaver". Null = include everything.
async function fetchOpfoelgninger(excludeMySalesId: number | null): Promise<{
  rows: OpfoelgningRow[];
  totalCount: number;
}> {
  const supabase = getSupabaseClient();
  const kontorRes = await supabase
    .from("sales")
    .select("id")
    .eq("lago_role", "kontor");
  if (kontorRes.error) throw kontorRes.error;
  const kontorIds = (kontorRes.data ?? []).map((s: { id: number }) => s.id);

  // §98-5c: queue-based instead of sales_id IS NULL.
  // Show tasks in ANY queue + tasks assigned to kontor users.
  const orParts: string[] = ["queue_id.not.is.null"];
  if (kontorIds.length > 0) {
    orParts.push(`sales_id.in.(${kontorIds.join(",")})`);
  }
  const orFilter = orParts.join(",");

  let countQuery = supabase
    .from("tasks")
    .select("id", { head: true, count: "exact" })
    .or(orFilter)
    .is("done_date", null);
  if (excludeMySalesId != null) {
    countQuery = countQuery.neq("sales_id", excludeMySalesId);
  }
  const countRes = await countQuery;
  if (countRes.error) throw countRes.error;
  const totalCount = countRes.count ?? 0;

  let rowQuery = supabase
    .from("tasks")
    .select(
      "id, text, type, due_date, contact_id, sales_id, sales:sales_id(id, first_name, last_name)",
    )
    .or(orFilter)
    .is("done_date", null)
    .order("due_date", { ascending: true })
    .limit(CLIP_TO);
  if (excludeMySalesId != null) {
    rowQuery = rowQuery.neq("sales_id", excludeMySalesId);
  }
  const { data, error } = await rowQuery;
  if (error) throw error;
  return {
    rows: (data as unknown as OpfoelgningRow[]) ?? [],
    totalCount,
  };
}

// dateFmt removed — CompactTaskRow handles date formatting.

/** Parser handoff-markeren og henter afsender + dato hvis den findes. */
function extractHandoff(text: string | null): {
  from: string;
  when: string;
} | null {
  if (!text) return null;
  const idx = text.indexOf(HANDOFF_MARKER);
  if (idx < 0) return null;
  const tail = text.slice(idx + HANDOFF_MARKER.length).trim();
  // Format: "DD. mmm YYYY af N". Splittet på " af " — første del =
  // dato, sidste del = navnet (kan indeholde mellemrum).
  const afIdx = tail.indexOf(" af ");
  if (afIdx < 0) return null;
  const when = tail.slice(0, afIdx).trim();
  const from =
    tail
      .slice(afIdx + 4)
      .trim()
      .split("\n")[0]
      ?.trim() ?? "";
  if (!from) return null;
  return { from, when };
}

export function OpfoelgningerKontorWidget() {
  const qc = useQueryClient();
  const actorSalesId = useActorSalesId();
  const authUserId = useAuthUserId();
  // §31b: exclude viewer's own tasks to avoid duplication with
  // "Mine opgaver" widget on the same page.
  const viewSalesId = useViewSalesId();

  const query = useQuery({
    queryKey: ["lago-opfoelgninger-kontor", viewSalesId],
    queryFn: () => fetchOpfoelgninger(viewSalesId),
    staleTime: 60_000,
  });

  const markDone = useMutation({
    mutationFn: async (taskId: number) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("tasks")
        .update({
          done_date: new Date().toISOString(),
          completed_by_sales_id: actorSalesId,
        })
        .eq("id", taskId);
      if (error) throw error;
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
      qc.invalidateQueries({ queryKey: ["lago-opfoelgninger-kontor"] });
      toast.success("Opgave klaret", {
        action: {
          label: "Fortryd",
          onClick: () => {
            void (async () => {
              const supabase = getSupabaseClient();
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
                queryKey: ["lago-opfoelgninger-kontor"],
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

  const rows = query.data?.rows ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  return (
    <WidgetShell
      title="Åbne opgaver"
      subtitle="Udestående opgaver — sendt fra sælgerne eller oprettet af kontoret"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      count={
        totalCount > 0
          ? { label: `${totalCount} åbne`, tone: "neutral" }
          : undefined
      }
      emptyState="Ingen åbne opgaver lige nu."
    >
      {/* §31c: compact task rows with origin. */}
      <Panel>
        <div>
          {rows.map((r) => {
            const handoff = extractHandoff(r.text);
            const salesName = r.sales
              ? [r.sales.first_name, r.sales.last_name]
                  .filter(Boolean)
                  .join(" ")
              : null;
            const isOwnAssigned =
              actorSalesId != null && r.sales_id === actorSalesId;
            const origin = handoff
              ? `Fra ${handoff.from}, ${handoff.when}`
              : isOwnAssigned
                ? "Egen"
                : salesName
                  ? `Tildelt: ${salesName}`
                  : null;
            const rawText = r.text?.trim() ?? "";
            const markerIndex = rawText.indexOf(HANDOFF_MARKER);
            const bodyText =
              markerIndex >= 0 ? rawText.slice(0, markerIndex).trim() : rawText;
            return (
              <CompactTaskRow
                key={r.id}
                id={r.id}
                text={bodyText || r.type || "Opgave uden tekst"}
                companyName={null}
                companyId={null}
                dueDate={r.due_date}
                origin={origin}
                actions={
                  <KontorTaskAction
                    onMarkDone={() => markDone.mutate(r.id)}
                    pending={markDone.isPending && markDone.variables === r.id}
                    taskText={bodyText || r.type || null}
                  />
                }
              />
            );
          })}
        </div>
      </Panel>
    </WidgetShell>
  );
}

function KontorTaskAction({
  onMarkDone,
  pending,
  taskText,
}: {
  onMarkDone: () => void;
  pending: boolean;
  taskText?: string | null;
}) {
  // §98-5a: confirmation before marking done
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <LagoButton
        variant="primary"
        primaryHeight={false}
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        {pending ? "Markerer …" : "Klaret"}
      </LagoButton>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Markér som klaret?</DialogTitle>
            <DialogDescription>
              {taskText
                ? `"${taskText.length > 80 ? taskText.slice(0, 80) + "…" : taskText}"`
                : "Opgaven markeres som klaret og forsvinder fra listen."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Annullér
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onMarkDone();
              }}
            >
              Ja, klaret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
