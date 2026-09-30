import {
  CalendarClock,
  CheckSquare,
  MapPin,
  Phone,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import {
  useMarkActivityDone,
  useSoftDeleteActivity,
} from "@/lago/registrer/mutations";
import { EditActivityDialog } from "@/lago/registrer/EditActivityDialog";
import { Icon } from "@/lago/ui/Icon";
import { RowActionsMenu } from "@/lago/dashboard/RowActionsMenu";

import type {
  CompanyLagoExtension,
  CompanyNote,
  ContactSummary,
  CustomerActivity,
  OpenTask,
} from "../types";

type TimelineTab = "all" | "notes" | "tasks" | "visits";
type TimelineKind = "note" | "task" | "visit" | "activity";

// Brief 41 (16. sep 2026): Redigér-flowet kalder update_activity RPC'en.
// Migrationen 20260919160000_lago_41_edit_activities.sql landede
// 17. sep 2026 (dagslys-godkendelse), og source='crm_native'-spærringen
// er nu fjernet fra soft-delete + mark_activity_done. Flaget er
// tændt — CRM-native og VISMA-importerede aktiviteter er lige rettelige.
const EDIT_ACTIVITY_ENABLED = true;

interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  date: string;
  title: string;
  detail?: string;
  contactName?: string;
  salesName?: string;
  activityType?: string | null;
  // Brief 16. sep 2026: felter der driver slet-knappen. Kun til stede
  // for `activity` / `visit`-rækker der stammer fra
  // customer_activities_lago — noter og opgaver har deres egne
  // sletmekanismer.
  activityRowId?: number;
  activityCompanyId?: number;
  activitySource?: string;
  activitySalesId?: number | null;
  // Brief 41 (16. sep 2026): felter der driver Redigér-knappen.
  // Kun til stede på activity/visit-rækker fra customer_activities_lago.
  activityTypeCode?: number | null;
  activityDate?: string;
  activityDescription?: string | null;
  // Brief 35 §4 (16. sep 2026): planlagt = fremtidig eller ikke-afholdt
  // CRM-aktivitet. Bæres separat fra `date` så prik + sortering +
  // "Markér som afholdt"-knappen kan reagere på det uden at ændre
  // eksisterende sammenligningslogik.
  isPlanned?: boolean;
}

// Brief 35 §4: "om 7 uger · 5. nov"-format for planlagte begivenheder.
// Ikke "5. nov 2026" — sælgeren skal se afstanden først, datoen efter.
function formatPlannedRelative(dateIso: string, now: Date = new Date()): string {
  const d = new Date(dateIso);
  const oneDay = 24 * 60 * 60 * 1000;
  const midnightNow = new Date(now);
  midnightNow.setHours(0, 0, 0, 0);
  const midnightDate = new Date(d);
  midnightDate.setHours(0, 0, 0, 0);
  const days = Math.round(
    (midnightDate.getTime() - midnightNow.getTime()) / oneDay,
  );
  const short = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(d);
  if (days <= 0) return `i dag · ${short}`;
  if (days === 1) return `i morgen · ${short}`;
  if (days < 14) return `om ${days} dage · ${short}`;
  const weeks = Math.round(days / 7);
  if (weeks <= 8) return `om ${weeks} ${weeks === 1 ? "uge" : "uger"} · ${short}`;
  const months = Math.round(days / 30);
  return `om ${months} ${months === 1 ? "måned" : "måneder"} · ${short}`;
}

interface CustomerTimelineProps {
  companyId: number;
  companyName?: string;
  notes: CompanyNote[];
  tasks: OpenTask[];
  extension: CompanyLagoExtension | null;
  contacts: ContactSummary[];
  activities?: CustomerActivity[];
}

function contactNameById(
  contacts: ContactSummary[],
  id: number | null | undefined,
): string | undefined {
  if (id == null) return undefined;
  const c = contacts.find((x) => x.id === id);
  if (!c) return undefined;
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || undefined;
}

function formatDate(value: string, locale = "da-DK") {
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

/**
 * Combined timeline showing notes, tasks and visits in chronological
 * order. Tabs let the sælger narrow the feed to one kind at a time.
 * Data is derived client-side from the existing per-page queries so this
 * doesn't add a round-trip; the "Besøg"-tab is a synthetic entry until
 * we start recording every visit (currently only the most recent one is
 * persisted on `companies_lago.last_visit_at`).
 */
export function CustomerTimeline({
  companyId,
  companyName,
  notes,
  tasks,
  extension,
  contacts,
  activities = [],
}: CustomerTimelineProps) {
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const [tab, setTab] = useState<TimelineTab>("all");

  // Brief 16. sep 2026: slet-knappen kræver at vi kender brugerens
  // sales.id og admin-status. Hentes en gang for hele tidslinjen.
  const { data: identity } = useGetIdentity();
  const { isAdmin } = useIsLagoAdmin();
  const currentSalesId =
    identity && typeof identity.id === "number" ? identity.id : null;
  const softDelete = useSoftDeleteActivity();
  const markDone = useMarkActivityDone();

  const entries = useMemo<TimelineEntry[]>(() => {
    // Brief 20 pkt 7: vis task-type-label ("Opkald") ikke rå value ("call").
    const taskTypeLabel = (v: string | null | undefined) =>
      v ? taskTypes.find((t) => t.value === v)?.label ?? v : undefined;

    const noteEntries: TimelineEntry[] = notes.map((n) => ({
      id: `note-${n.id}`,
      kind: "note",
      date: n.created_at,
      title: n.text,
      contactName: contactNameById(contacts, n.contact_id),
    }));

    const taskEntries: TimelineEntry[] = tasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      date: t.due_date ?? new Date().toISOString(),
      title: t.text,
      detail: taskTypeLabel(t.type),
      contactName: contactNameById(contacts, t.contact_id),
    }));

    // VISMA-seeded activities. Type 1 = Besøg (goes to the visits tab),
    // everything else is a general activity that lives under "Alle".
    // Brief 35 §4: en aktivitet er "planlagt" hvis den er en fremtidig
    // dato eller har done=false. Historik og planlagt vises i separate
    // sektioner nedenfor — TimelineEntry bærer flaget så filter-tabs +
    // sortering forbliver simple.
    const activityEntries: TimelineEntry[] = activities.map((a) => ({
      id: `activity-${a.id}`,
      kind: a.activity_type_code === 1 ? "visit" : "activity",
      date: a.activity_date,
      title:
        a.description ??
        a.activity_type ??
        translate("lago.customer.timeline.visit_marker"),
      salesName: a.sales_name ?? undefined,
      activityType: a.activity_type,
      // Brief 16. sep 2026: bær aktivitetens id/source/sales_id
      // gennem, så TimelineRow kan afgøre om slet-knappen skal vises.
      activityRowId: a.id,
      activityCompanyId: a.company_id,
      activitySource: a.source,
      activitySalesId: a.sales_id,
      // Brief 41: felter Redigér-dialogen har brug for.
      activityTypeCode: a.activity_type_code,
      activityDate: a.activity_date,
      activityDescription: a.description,
      isPlanned: a.done === false,
    }));

    const filtered = (() => {
      if (tab === "all")
        return [...noteEntries, ...taskEntries, ...activityEntries];
      if (tab === "notes") return noteEntries;
      if (tab === "tasks") return taskEntries;
      // visits: activities of type Besøg (+ legacy single last_visit_at
      // fallback if for some reason no activity row seeded it).
      const visits = activityEntries.filter((e) => e.kind === "visit");
      if (
        visits.length === 0 &&
        extension?.last_visit_at
      ) {
        visits.push({
          id: `visit-last-${extension.last_visit_at}`,
          kind: "visit",
          date: extension.last_visit_at,
          title: translate("lago.customer.timeline.visit_marker"),
        });
      }
      return visits;
    })();

    return filtered.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [notes, tasks, extension, contacts, activities, tab, translate, taskTypes]);

  // Brief 35 §4 (16. sep 2026): planlagte begivenheder står for sig
  // øverst — de er løfter, ikke spor. Historikken (afholdt + noter +
  // tasks) står i sin egen sektion under. En planlagt aktivitet
  // dukker aldrig op i "Historik" før den er markeret afholdt.
  const plannedEntries = entries.filter((e) => e.isPlanned === true);
  const historyEntries = entries.filter((e) => e.isPlanned !== true);

  // Slet-eligibility server-side sandheden er RPC'en; klient-side check
  // gemmer knappen når krav ikke er opfyldt.
  const canWriteActivity = (entry: TimelineEntry) =>
    entry.activityRowId != null &&
    entry.activitySource === "crm_native" &&
    (isAdmin ||
      (currentSalesId != null && entry.activitySalesId === currentSalesId));

  // Brief 41 (16. sep 2026): rediger-flow — samme ejer/admin-check som
  // slet. source-spærringen er væk (migrationen fjerner den for alle
  // tre RPC'er), så VISMA-importerede rækker kan også rettes.
  const [editEntry, setEditEntry] = useState<TimelineEntry | null>(null);
  // Til "hvad flytter kunden"-advarslen: hvis den aktivitet, der
  // redigeres, er kundens seneste besøg, skal vi kende den næst-seneste
  // så vi kan sige "kunden regnes herefter som senest besøgt X".
  const lastVisitWithoutEdited = useMemo(() => {
    if (!editEntry?.activityRowId) return null;
    const otherVisitDates = activities
      .filter(
        (a) =>
          a.id !== editEntry.activityRowId &&
          a.activity_type_code === 1 &&
          a.done &&
          a.activity_date <= new Date().toISOString().slice(0, 10),
      )
      .map((a) => a.activity_date)
      .sort()
      .reverse();
    return otherVisitDates[0] ?? null;
  }, [editEntry, activities]);

  const renderRow = (entry: TimelineEntry) => {
    const canEdit = canWriteActivity(entry) && EDIT_ACTIVITY_ENABLED;
    const canDelete = canWriteActivity(entry);
    // Brief 87 audit-svar (28. sep 2026): navngiv ejeren når aktiviteten
    // ikke er ens egen (admin ser fx på Peters række). Bruges til andet-
    // kliks-tekst på "Markér som afholdt" og til slet-dialogens ejer-linje.
    const ownerLabelWhenOther =
      currentSalesId != null &&
      entry.activitySalesId != null &&
      entry.activitySalesId !== currentSalesId
        ? (entry.salesName ?? null)
        : null;
    return (
      <TimelineRow
        key={entry.id}
        entry={entry}
        onMarkDone={
          entry.isPlanned && canDelete
            ? (newDate?: string) =>
                markDone.mutate({
                  activityId: entry.activityRowId!,
                  companyId,
                  companyName,
                  newDate: newDate ?? null,
                })
            : undefined
        }
        onEdit={canEdit ? () => setEditEntry(entry) : undefined}
        onDelete={
          canDelete
            ? () =>
                softDelete.mutate({
                  activityId: entry.activityRowId!,
                  companyId,
                  companyName,
                })
            : undefined
        }
        disabled={softDelete.isPending || markDone.isPending}
        ownerLabelWhenOther={ownerLabelWhenOther}
      />
    );
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base font-bold">
          {translate("lago.customer.sections.timeline")}
        </CardTitle>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TimelineTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-sm">
              {translate("lago.customer.timeline.tab_all")}
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-sm">
              {translate("lago.customer.timeline.tab_notes")}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm">
              {translate("lago.customer.timeline.tab_tasks")}
            </TabsTrigger>
            <TabsTrigger value="visits" className="text-sm">
              {translate("lago.customer.timeline.tab_visits")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            {translate("lago.customer.empty.no_timeline")}
          </p>
        ) : (
          <div className="space-y-5">
            {plannedEntries.length > 0 && (
              <section>
                <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">
                  Planlagt
                </h3>
                <ol className="relative space-y-4 border-l pl-5">
                  {plannedEntries.map(renderRow)}
                </ol>
              </section>
            )}
            {historyEntries.length > 0 && (
              <section>
                {plannedEntries.length > 0 && (
                  <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--fg-3)]">
                    Historik
                  </h3>
                )}
                <ol className="relative space-y-4 border-l pl-5">
                  {historyEntries.map(renderRow)}
                </ol>
              </section>
            )}
          </div>
        )}
      </CardContent>
      {editEntry?.activityRowId != null && (
        <EditActivityDialog
          open={editEntry != null}
          onOpenChange={(v) => {
            if (!v) setEditEntry(null);
          }}
          activity={{
            id: editEntry.activityRowId,
            company_id: editEntry.activityCompanyId ?? companyId,
            activity_date: editEntry.activityDate ?? editEntry.date,
            activity_type_code: editEntry.activityTypeCode ?? null,
            description: editEntry.activityDescription ?? null,
          }}
          companyName={companyName}
          lastVisitWithoutThis={lastVisitWithoutEdited}
        />
      )}
    </Card>
  );
}

function TimelineRow({
  entry,
  onMarkDone,
  onEdit,
  onDelete,
  disabled,
  ownerLabelWhenOther,
}: {
  entry: TimelineEntry;
  /** Brief 35 §4: kun sat på planlagte aktiviteter der ejes af brugeren
   *  (eller admin). Kaldes med valgfri ny dato hvis begivenheden skete
   *  en anden dag end oprindeligt planlagt. */
  onMarkDone?: (newDate?: string) => void;
  /** Brief 41 (16. sep 2026): åbner EditActivityDialog for aktiviteter
   *  der ejes af brugeren (eller admin). */
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  /**
   * Brief 87 audit-svar (28. sep 2026): sat når aktiviteten er en andens
   * (admin ser på Peters aktivitet fx). Bruges til andet-kliks-teksten
   * på "Markér som afholdt" og til slet-dialogens "det er Xs …"-linje.
   * Null = det er ens egen; ingen særlig tekst.
   */
  ownerLabelWhenOther?: string | null;
}) {
  const translate = useTranslate();
  // Brief 87 audit-svar #1 (28. sep 2026): to-kliks-mønster på "Markér
  // som afholdt" — samme mekanik som MineOpgaverWidget. Første klik viser
  // en advarsel; andet klik udfører. Under 3 sekunder falder tilstanden
  // tilbage. Er aktiviteten en andens: teksten navngiver ejeren.
  const [confirming, setConfirming] = useState(false);
  // Brief 87 audit-svar #2 (28. sep 2026): sletning kræver dialog, alle
  // bredder. Ingen ny komponent — shadcn Dialog inline.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const icon = entry.isPlanned ? (
    <Icon icon={CalendarClock} size="sm" />
  ) : entry.kind === "note" ? (
    <Icon icon={StickyNote} size="sm" />
  ) : entry.kind === "task" ? (
    <Icon icon={CheckSquare} size="sm" />
  ) : entry.kind === "visit" ? (
    <Icon icon={MapPin} size="sm" />
  ) : entry.activityType?.toLowerCase().includes("opk") ? (
    <Icon icon={Phone} size="sm" />
  ) : (
    <Icon icon={Sparkles} size="sm" />
  );
  // Brief 35 §4 (16. sep 2026): planlagt prik = omrids, intet fyld —
  // "det er ikke sket endnu". --line-strong bruges så prikken flugter
  // med de andre linjer i systemet. Afholdte prikker beholder deres
  // status-token-farve fra brief 33 §4.
  const dotClass = entry.isPlanned
    ? "bg-background ring-1 ring-[var(--line-strong)]"
    : entry.kind === "note"
      ? "bg-[var(--st-blue)]"
      : entry.kind === "task"
        ? "bg-[var(--st-amber)]"
        : entry.kind === "visit"
          ? "bg-[var(--st-green)]"
          : "bg-[var(--ink)]";
  const dateLabel = entry.isPlanned
    ? formatPlannedRelative(entry.date)
    : formatDate(entry.date);
  // Brief 41 (16. sep 2026): Redigér over Slet i ⋯-menuen. Skillelinjen
  // opnås ved simple mellemrum — RowActionsMenu understøtter ikke egne
  // separators, men rækkefølgen alene løser det Jonas bad om.
  const rowActions = [
    ...(onEdit
      ? [
          {
            label: translate("lago.customer.timeline.edit_activity", {
              _: "Redigér",
            }),
            onSelect: onEdit,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: translate("lago.customer.timeline.delete_activity", {
              _: "Slet",
            }),
            // Brief 87 audit-svar #2: åbner dialog, sletter ikke direkte.
            onSelect: () => setDeleteOpen(true),
            destructive: true,
          },
        ]
      : []),
  ];
  return (
    <li className="group relative">
      <span
        aria-hidden
        className={`absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background ${dotClass}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1">{icon}</span>
            <span>{dateLabel}</span>
            {entry.activityType && entry.kind !== "note" && entry.kind !== "task" && (
              <Badge variant="secondary" className="font-normal">
                {entry.activityType}
              </Badge>
            )}
            {entry.contactName && (
              <Badge variant="outline" className="font-normal">
                {translate("lago.customer.note.about_contact", {
                  name: entry.contactName,
                })}
              </Badge>
            )}
            {entry.salesName && (
              <span className="italic">· {entry.salesName}</span>
            )}
          </div>
          <div className="text-sm break-words whitespace-pre-wrap">
            {entry.title}
          </div>
          {entry.detail && (
            <div className="text-muted-foreground text-sm">{entry.detail}</div>
          )}
        </div>
        {onMarkDone && (
          <div className="flex shrink-0 items-center gap-1">
            {/* Brief 35 §4: primær handling på en planlagt række =
                "Markér som afholdt". Uden ny dato → RPC bruger dagens
                dato. Skete det en anden dag, kan sælgeren rette det på
                selve rækken via Redigér i ⋯-menuen (brief 41).
                Brief 87 audit-svar #1 (28. sep 2026): to-kliks-mønster.
                Første klik advarer (og navngiver ejeren hvis andens);
                andet klik udfører. Falder tilbage efter 3 sekunder. */}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  window.setTimeout(() => setConfirming(false), 3000);
                  return;
                }
                setConfirming(false);
                onMarkDone();
              }}
              disabled={disabled}
              className="min-h-9 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
            >
              {confirming
                ? ownerLabelWhenOther
                  ? `Klik igen — det er ${ownerLabelWhenOther}s besøg`
                  : "Klik igen for at bekræfte"
                : "Markér som afholdt"}
            </Button>
            <RowActionsMenu ariaLabel="Flere handlinger" actions={rowActions} />
          </div>
        )}
        {/* Brief 41 (16. sep 2026): på afholdte rækker havde vi tidligere
            kun en tavs slet-knap. Nu vises ⋯-menuen med Redigér + Slet
            så sælgeren kan rette en stavefejl uden at slette + skrive
            igen. Trash-knappen erstattet af ⋯. */}
        {!onMarkDone && rowActions.length > 0 && (
          <div className="shrink-0">
            <RowActionsMenu
              ariaLabel="Flere handlinger"
              actions={rowActions}
            />
          </div>
        )}
      </div>
      {/* Brief 87 audit-svar #2 (28. sep 2026): slet-dialog, alle bredder.
          Navngiver hvad der slettes (aktivitetens tekst); under dækning
          eller admin-visning navngives også ejeren. Ingen ny komponent —
          shadcn Dialog inline. Knapper: Slet (destruktiv) og Fortryd. */}
      {onDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Slet aktivitet?</DialogTitle>
              <DialogDescription>
                Aktiviteten forsvinder fra kunden. Kan fortrydes i toast'en
                de næste 5 sekunder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <div className="text-[13px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
                  Aktivitet
                </div>
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--fg)]">
                  {entry.title?.trim() || "(uden tekst)"}
                </p>
              </div>
              {ownerLabelWhenOther && (
                <p className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
                  Dette er {ownerLabelWhenOther}s aktivitet.
                </p>
              )}
            </div>
            <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={disabled}
              >
                Fortryd
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  onDelete();
                }}
                disabled={disabled}
                className="bg-[var(--st-red-fg)] text-white hover:bg-[var(--st-red-fg)]/90"
              >
                Slet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}
