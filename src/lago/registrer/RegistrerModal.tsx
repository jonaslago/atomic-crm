import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  ClipboardList,
  Loader2,
  MessageSquare,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslate } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Icon } from "@/lago/ui/Icon";

import type { ContactSummary } from "@/lago/customers/types";

import { ForslagListe, type AiRunSummary } from "@/lago/ai/ForslagListe";
import type { AktivtForslag } from "@/lago/ai/ForslagKort";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { useActorSalesId } from "@/lago/portefolje/useActorSalesId";
import { fetchCustomerList } from "@/lago/customers/dataAccess";
import type { SelectedCompany } from "@/lago/dashboard/DashboardKundePicker";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";
import { FollowUpBuilder, type ManualFollowUp } from "./FollowUpBuilder";

import {
  isPlannedDateIso,
  splitNameAtLast,
  useCreateInlineContact,
  usePlanNextVisit,
  useRegisterAktivitet,
  useRegisterBesoeg,
  useRegisterNote,
  useRegisterOpgave,
} from "./mutations";
import { AKTIVITET_TYPES } from "./types";
import { useAssignableUsers, type AssignableUser } from "./useAssignableUsers";

type TabKey = "besoeg" | "aktivitet" | "opgave" | "note" | "planlaeg";

const NO_CONTACT = "__none__";
// §98-5b: "Ingen" as default — not a pre-selected type the user hasn't chosen.
const DEFAULT_TASK_TYPE = "none";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchCompanyContacts(
  companyId: number,
): Promise<ContactSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, title, status, email_jsonb, phone_jsonb",
    )
    .eq("company_id", companyId)
    .order("last_name", { ascending: true })
    .returns<ContactSummary[]>();
  if (error) throw error;
  return data ?? [];
}

function contactLabel(c: ContactSummary): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || `#${c.id}`
  );
}

interface RegistrerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional — when omitted, the modal shows a customer picker as step 1.
   *  §41b (1. okt 2026): one modal, not two. The picker is the first step
   *  inside the modal. The customer selection can't be lost in a state
   *  transition between two modals. */
  companyId?: number;
  companyName?: string;
  /** Initial tab; useful when the trigger has a specific intent. */
  initialTab?: TabKey;
  /**
   * Brief 15 · FS-20: kaldes efter et gemt besøg når sælgeren valgte
   * "Gem & planlæg næste". Parent (RegistrerButton) ejer PlanVisitDialog
   * som sibling, så den ikke er child af den dialog der lige lukkede.
   */
  onRequestPlanNext?: () => void;
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  currentPlannedIso?: string | null;
  currentNote?: string | null;
}

/**
 * Domain-brief 10 · Registrér-modal. One reusable Dialog with four tabs:
 * Besøg (default) · Aktivitet · Opgave · Note. Same modal is used by
 * felt-kortene (Dagens/Søg) and the customer page (3c), so the write
 * mønster er ét sted. The note is the main field for Besøg and
 * Aktivitet — the "hvad skete der?" is the reason we are recording.
 */
export function RegistrerModal({
  open,
  onOpenChange,
  companyId: propCompanyId,
  companyName: propCompanyName,
  initialTab = "besoeg",
  onRequestPlanNext,
  segment: propSegment = null,
  currentPlannedIso = null,
  currentNote = null,
}: RegistrerModalProps) {
  const translate = useTranslate();
  const [tab, setTab] = useState<TabKey>(initialTab);

  // §41b (1. okt 2026): internal selected company state. When
  // companyId/companyName are passed as props (e.g. from customer card),
  // we use those. When not (e.g. from dashboard action bar), the modal
  // shows a customer picker as step 1.
  const [internalCompany, setInternalCompany] =
    useState<SelectedCompany | null>(null);
  const hasPropsCompany = propCompanyId != null && propCompanyName != null;
  const company = hasPropsCompany
    ? { id: propCompanyId, name: propCompanyName, segment: propSegment }
    : internalCompany;

  // Reset internal state when modal closes.
  useEffect(() => {
    if (!open) {
      setInternalCompany(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const companyId = company?.id ?? 0;
  const companyName = company?.name ?? "";
  const segment = company?.segment ?? propSegment;

  const contactsQuery = useQuery({
    queryKey: ["lago-registrer-contacts", companyId],
    queryFn: () => fetchCompanyContacts(companyId),
    enabled: open && companyId > 0,
  });

  // §41b: if no company selected yet, show the inline picker.
  if (!company) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Registrér — vælg kunde</DialogTitle>
            <DialogDescription className="sr-only">
              Vælg en kunde at registrere på
            </DialogDescription>
          </DialogHeader>
          <InlineCustomerPicker onSelect={(c) => setInternalCompany(c)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {!hasPropsCompany && (
              <button
                type="button"
                onClick={() => setInternalCompany(null)}
                className="rounded p-1 hover:bg-[var(--surface-1)]"
                title="Skift kunde"
              >
                <Icon icon={ArrowLeft} size="sm" />
              </button>
            )}
            {translate("lago.registrer.title", { name: companyName })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {translate("lago.registrer.button_hint")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabKey)}
          className="flex flex-col"
        >
          {/* §41c (1. okt 2026): 5 tabs always — Planlæg is no longer
              role-gated. Tab labels hidden under 420px to fit all five. */}
          <TabsList className="sticky top-0 z-10 mx-6 grid h-11 grid-cols-5 bg-background">
            <TabsTrigger value="besoeg" className="gap-1 text-sm">
              <Icon icon={CalendarCheck2} size="sm" />
              <span className="hidden min-[420px]:inline">
                {translate("lago.registrer.tabs.besoeg")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="aktivitet" className="gap-1 text-sm">
              <Icon icon={Sparkles} size="sm" />
              <span className="hidden min-[420px]:inline">
                {translate("lago.registrer.tabs.aktivitet")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="opgave" className="gap-1 text-sm">
              <Icon icon={ClipboardList} size="sm" />
              <span className="hidden min-[420px]:inline">
                {translate("lago.registrer.tabs.opgave")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="note" className="gap-1 text-sm">
              <Icon icon={MessageSquare} size="sm" />
              <span className="hidden min-[420px]:inline">
                {translate("lago.registrer.tabs.note")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="planlaeg" className="gap-1 text-sm">
              <Icon icon={CalendarClock} size="sm" />
              <span className="hidden min-[420px]:inline">
                {translate("lago.registrer.tabs.planlaeg", {
                  _: "Planlæg",
                })}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="besoeg"
            forceMount
            className={cn("mt-0", tab !== "besoeg" && "hidden")}
          >
            <BesoegForm
              companyId={companyId}
              companyName={companyName}
              contacts={contactsQuery.data ?? []}
              contactsLoading={contactsQuery.isLoading}
              contactsError={contactsQuery.error as Error | null}
              onDone={() => onOpenChange(false)}
              onDoneAndPlanNext={
                onRequestPlanNext
                  ? () => {
                      onOpenChange(false);
                      onRequestPlanNext();
                    }
                  : undefined
              }
            />
          </TabsContent>
          <TabsContent
            value="aktivitet"
            forceMount
            className={cn("mt-0", tab !== "aktivitet" && "hidden")}
          >
            <AktivitetForm
              companyId={companyId}
              companyName={companyName}
              contacts={contactsQuery.data ?? []}
              contactsLoading={contactsQuery.isLoading}
              contactsError={contactsQuery.error as Error | null}
              onDone={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent
            value="opgave"
            forceMount
            className={cn("mt-0", tab !== "opgave" && "hidden")}
          >
            <OpgaveForm
              companyId={companyId}
              companyName={companyName}
              contacts={contactsQuery.data ?? []}
              loading={contactsQuery.isLoading}
              onDone={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent
            value="note"
            forceMount
            className={cn("mt-0", tab !== "note" && "hidden")}
          >
            <NoteForm
              companyId={companyId}
              companyName={companyName}
              contacts={contactsQuery.data ?? []}
              loading={contactsQuery.isLoading}
              onDone={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent
            value="planlaeg"
            forceMount
            className={cn("mt-0", tab !== "planlaeg" && "hidden")}
          >
            <PlanleagForm
              companyId={companyId}
              companyName={companyName}
              segment={segment}
              currentPlannedIso={currentPlannedIso}
              currentNote={currentNote}
              onDone={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Inline customer picker (§41b — step 1 inside the modal)
// ---------------------------------------------------------------------

/** Today's registrations for the current salesperson. */
async function fetchTodaysRegCompanyIds(salesId: number): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseClient()
    .from("customer_activities_lago")
    .select("company_id")
    .eq("sales_id", salesId)
    .eq("activity_date", today)
    .is("deleted_at", null)
    .order("id", { ascending: false });
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.company_id as number))];
}

/** Company IDs with a planned visit today or later. */
async function fetchPlannedCompanyIds(): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseClient()
    .from("companies_lago")
    .select("company_id")
    .not("next_visit_planned", "is", null)
    .gte("next_visit_planned", `${today}T00:00:00`)
    .order("next_visit_planned", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.company_id as number);
}

function InlineCustomerPicker({
  onSelect,
}: {
  onSelect: (c: SelectedCompany) => void;
}) {
  const mySalesId = useViewSalesId();
  const [q, setQ] = useState("");

  const allQuery = useQuery({
    queryKey: ["lago-registrer-picker-all"],
    queryFn: () => fetchCustomerList({ onlyMine: false }),
    staleTime: 60_000,
  });

  const todayQuery = useQuery({
    queryKey: ["lago-registrer-picker-today", mySalesId],
    queryFn: () => fetchTodaysRegCompanyIds(mySalesId!),
    enabled: mySalesId != null,
    staleTime: 30_000,
  });

  const plannedQuery = useQuery({
    queryKey: ["lago-registrer-picker-planned"],
    queryFn: () => fetchPlannedCompanyIds(),
    staleTime: 30_000,
  });

  const { todayRows, plannedRows, searchRows } = useMemo(() => {
    const rows = allQuery.data ?? [];
    const todayIds = new Set(todayQuery.data ?? []);
    const plannedIds = new Set(plannedQuery.data ?? []);
    const needle = q.trim().toLowerCase();

    if (needle) {
      const matched = rows
        .filter((r) => {
          const hay = [r.name, r.city ?? ""].join(" ").toLowerCase();
          return hay.includes(needle);
        })
        .slice(0, 20);
      return { todayRows: [], plannedRows: [], searchRows: matched };
    }

    const today = rows.filter((r) => todayIds.has(r.id));
    const planned = rows.filter(
      (r) => plannedIds.has(r.id) && !todayIds.has(r.id),
    );
    return { todayRows: today, plannedRows: planned, searchRows: [] };
  }, [allQuery.data, todayQuery.data, plannedQuery.data, q]);

  const isPending =
    allQuery.isPending || todayQuery.isPending || plannedQuery.isPending;
  const hasAny =
    todayRows.length > 0 || plannedRows.length > 0 || searchRows.length > 0;

  const select = (row: {
    id: number;
    name: string;
    extension?: { segment?: "A" | "B" | "C" | "X" | "L" | null };
  }) => {
    onSelect({
      id: row.id,
      name: row.name,
      segment: row.extension?.segment ?? null,
    });
  };

  return (
    <>
      <div className="border-b border-[var(--line)] px-6 pt-1 pb-3">
        <div className="relative">
          <Icon
            icon={SearchIcon}
            size="sm"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--fg-3)]"
          />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kundenavn eller by"
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Icon icon={Loader2} className="animate-spin" />
            Henter kunder …
          </div>
        ) : !hasAny && !q.trim() ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            Begynd at skrive for at søge.
          </p>
        ) : !hasAny && q.trim() ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            Ingen kunder matcher søgningen.
          </p>
        ) : (
          <div className="flex flex-col">
            {todayRows.length > 0 && (
              <PickerSection label="Dagens registreringer">
                {todayRows.map((row) => (
                  <PickerItem key={row.id} row={row} onSelect={select} />
                ))}
              </PickerSection>
            )}
            {plannedRows.length > 0 && (
              <PickerSection label="Planlagte besøg">
                {plannedRows.map((row) => (
                  <PickerItem key={row.id} row={row} onSelect={select} />
                ))}
              </PickerSection>
            )}
            {searchRows.length > 0 && (
              <ul className="flex flex-col">
                {searchRows.map((row) => (
                  <PickerItem key={row.id} row={row} onSelect={select} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function PickerSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-4 pt-2 pb-1 text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
        {label}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function PickerItem({
  row,
  onSelect,
}: {
  row: { id: number; name: string; city?: string | null };
  onSelect: (row: { id: number; name: string }) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row)}
        className="flex w-full min-h-11 items-baseline gap-3 rounded-md px-4 py-2 text-left hover:bg-[var(--surface-1)]"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">
          {row.name}
        </span>
        {row.city && (
          <span className="shrink-0 text-[13px] text-[var(--fg-3)]">
            {row.city}
          </span>
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------

interface FormBaseProps {
  companyId: number;
  companyName: string;
  onDone: () => void;
}

interface BesoegFormProps extends FormBaseProps {
  /** Brief 15: kaldes efter succesfuld registrering — parent åbner
   *  PlanVisitDialog med auto-forslag i stedet for at lukke helt. */
  onDoneAndPlanNext?: () => void;
  /** Brief 21 (AI-3): kunden's kontakter — bruges til at binde
   *  tilfoejede AI-forslag som tasks paa foerste kontakt. */
  contacts?: ContactSummary[];
  /** Brief 40 (16. sep 2026): tre distinkte tilstande skal kunne
   *  skelnes fra hinanden — hentes stadig, hentning fejlede, hentet
   *  men tom. Kollapset "null" fangede alle tre og fabrikerede en
   *  falsk "kunden har ingen kontakter"-advarsel. */
  contactsLoading?: boolean;
  contactsError?: Error | null;
}

function BesoegForm({
  companyId,
  companyName,
  contacts = [],
  contactsLoading = false,
  contactsError = null,
  onDone,
  onDoneAndPlanNext,
}: BesoegFormProps) {
  const translate = useTranslate();
  const performer = usePerformerPicker();
  const [date, setDate] = useState(todayIso());
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiForslag, setAiForslag] = useState<AktivtForslag[]>([]);
  // Tillæg 21A: AI-udfaldet (returned/added/rejected/ignored + llmCallId)
  // rapporteres ved gem-tid uanset om sælgeren tilføjede noget. Null
  // hvis "Foreslå opfølgninger" aldrig blev trykket eller kaldet fejlede.
  const [aiSummary, setAiSummary] = useState<AiRunSummary | null>(null);
  // Brief 40 tillæg A: manuelle opfølgninger side om side med AI-forslag.
  // Samme mutation-payload, forskellig databinding (ai_llm_call_id fravær
  // = manuel oprindelse). AssigneePicker deles med "Udført af" og bruger
  // samme lister — men vi vil have Backoffice-kø som gyldig modtager på
  // opfølgningen, så vi bruger useAssigneePicker (ikke usePerformerPicker).
  const followUpAssignee = useAssigneePicker();
  // Brief 84 §4 (28. sep 2026): standard-modtager af en ny opfølgning =
  // viewSalesId (Camilla under dækning, actor ellers). Ikke pickerens
  // "Mig" — vælgeren er stadig UI'en hvor sælgeren kan overskrive.
  const viewSalesId = useViewSalesId();
  const [manualFollowUps, setManualFollowUps] = useState<ManualFollowUp[]>([]);
  const mutation = useRegisterBesoeg();
  // Brief 40: inline-opret-kontakt lever KUN på Besøg-fanen, og kun når
  // kunden faktisk ingen kontakter har OG sælgeren har tilføjet AI-forslag.
  // For andre tilfælde (kontakt findes, opslag fejlede, henter stadig)
  // er formen ikke synlig — samme mekanik som ContactsCard bruger.
  const createContact = useCreateInlineContact();
  const [newContactName, setNewContactName] = useState("");

  const primaryContactId = contacts[0]?.id ?? null;
  const hasCustomerContacts = contacts.length > 0;

  const handleForslagChange = (
    aktive: AktivtForslag[],
    summary: AiRunSummary,
  ) => {
    setAiForslag(aktive);
    setAiSummary(summary);
  };

  const handleCreateContactInline = () => {
    const trimmed = newContactName.trim();
    if (!trimmed) return;
    createContact.mutate(
      { companyId, companyName, name: trimmed },
      {
        onSuccess: () => setNewContactName(""),
      },
    );
  };

  const runSubmit = (thenPlanNext: boolean) => {
    setError(null);
    // Brief 35 §2 (16. sep 2026): kun én måde at planlægge et besøg —
    // Planlæg besøg (FS-20). Fremtidige datoer på Besøg-fanen ville
    // give os to konkurrerende mekanismer og kunder der står to gange
    // på Dagens. Peg det rigtige sted hen.
    if (isPlannedDateIso(date)) {
      setError(
        translate("lago.registrer.besoeg.future_date_blocked", {
          _: "Et besøg planlægges med Planlæg besøg — så ryger det i Dagens.",
        }),
      );
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setError(translate("lago.registrer.empty_note_error"));
      return;
    }
    mutation.mutate(
      {
        companyId,
        companyName,
        dateIso: date,
        description: trimmed,
        performedByName: performer.selectedName,
        performedBySalesId: performer.selectedSalesId,
        aiForslag: aiForslag.map((f) => ({
          type: f.type,
          tekst: f.tekst,
          dato: f.dato,
          original_tekst: f.original_tekst,
          original_dato: f.original_dato,
          edited: f.edited,
        })),
        aiSummary: aiSummary && aiSummary.llmCallId != null ? aiSummary : null,
        primaryContactId,
        // Brief 40: signalér de tre distinkte tilstande så onSuccess-
        // advarslen kun affyres, når den er sand.
        hasCustomerContacts,
        contactsFetchFailed: !!contactsError,
        // Brief 40 tillæg A: manuelle opfølgninger fra FollowUpBuilder.
        manualFollowUps: manualFollowUps.map((m) => ({
          text: m.text,
          dueDateIso: m.dueDateIso,
          assigneeSalesId: m.assigneeSalesId,
        })),
      },
      {
        onSuccess: () => {
          if (thenPlanNext && onDoneAndPlanNext) onDoneAndPlanNext();
          else onDone();
        },
      },
    );
  };

  // Brief 40 + tillæg A: kun synlig når kunden reelt ingen kontakter har
  // OG sælgeren har tilføjet noget (AI-forslag eller manuel opfølgning).
  // Sikrer at ingen af de to indgange taber data stille — sælgeren får
  // chancen for at oprette en kontakt uden at forlade modalen.
  // contactsLoading og contactsError har egne beskeder ovenover.
  const showInlineContactCreator =
    !contactsLoading &&
    !contactsError &&
    contacts.length === 0 &&
    (aiForslag.length > 0 || manualFollowUps.length > 0);

  return (
    <FormShell
      onCancel={onDone}
      onSubmit={() => runSubmit(false)}
      submitLabel={translate("lago.registrer.besoeg.submit")}
      submitting={mutation.isPending}
      extraAction={
        onDoneAndPlanNext
          ? {
              label: translate("lago.registrer.besoeg.submit_and_plan"),
              onClick: () => runSubmit(true),
            }
          : undefined
      }
    >
      {/* Brief 22a #2 + 42 §2 (rettet 16. sep 2026): min-h-11 (44 px) på
          alle kontroller — designsystemets gulv for trykflader, jf.
          bridge.css. min-w-0 på både grid-kolonner og date-input:
          iOS's native <input type="date"> har en indbygget bredde, og
          et grid-element krymper ikke under indholdets naturlige bredde
          medmindre man beder om det. Uden reglen flyder feltet ud over
          kolonnen ved 375 px. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="besoeg-date" className="text-sm">
            {translate("lago.registrer.besoeg.date_label")}
          </Label>
          <Input
            id="besoeg-date"
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full min-w-0"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-sm">
            {translate("lago.registrer.besoeg.performed_by_label")}
          </Label>
          <PerformerSelect
            state={performer}
            className="min-h-11 w-full min-w-0"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="besoeg-note" className="text-sm font-bold">
          {translate("lago.registrer.besoeg.note_label")}
        </Label>
        <Textarea
          id="besoeg-note"
          rows={5}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={translate("lago.registrer.besoeg.note_placeholder")}
          className="text-sm"
        />
      </div>
      {/* Brief 21 (AI-3): "Foreslaa opfoelgninger" under notefeltet.
          Kaldet er isoleret — det maa aldrig blokere Gem besoeg-knappen
          eller ophobe modal-luk. Kraever mindst én kontakt paa kunden
          for at kunne skrive forslag som tasks; ellers viser vi kun UI'et
          men Gem-flow'et logger en advarsel. */}
      <ForslagListe
        note={text}
        companyId={companyId}
        salesId={performer.selectedSalesId}
        onChange={handleForslagChange}
      />
      {/* Brief 40 tillæg A: manuel opfølgning uden AI. Samme kontakt-
          binding som AI-forslag; markøren AI vs manuel er fravær/
          tilstedeværelse af ai_llm_call_id på task-rækken. */}
      <FollowUpBuilder
        items={manualFollowUps}
        onItemsChange={setManualFollowUps}
        assignableUsers={followUpAssignee.options}
        defaultAssigneeSalesId={viewSalesId}
      />
      {/* Brief 40: én af tre distinkte tilstande — vises kun når den
          er sand. Kontakter der loader støjer ikke; en fejl har egen
          farve; tom-og-noget-tilføjet tilbyder inline-oprettelse. */}
      {contactsLoading &&
        (aiForslag.length > 0 || manualFollowUps.length > 0) && (
          <p className="text-[13px] text-[var(--fg-2)]">
            <Icon
              icon={Loader2}
              size="sm"
              className="mr-1 inline animate-spin"
            />
            Henter kontakter så forslagene kan bindes…
          </p>
        )}
      {contactsError &&
        (aiForslag.length > 0 || manualFollowUps.length > 0) && (
          <p className="text-destructive text-sm">
            Kunne ikke hente kontakter — opfølgninger kan ikke bindes lige nu.
            Prøv at åbne kundens side og opdatere.
          </p>
        )}
      {showInlineContactCreator && (
        <div className="rounded-md border border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)] p-3">
          <p className="text-sm text-[var(--fg)]">
            Kunden har ingen kontakter endnu — opret én her, så bliver
            AI-forslagene gemt på den.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Fornavn (og evt. efternavn)"
              className="min-h-11 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newContactName.trim()) {
                  e.preventDefault();
                  handleCreateContactInline();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="min-h-11 gap-1"
              onClick={handleCreateContactInline}
              disabled={createContact.isPending || !newContactName.trim()}
            >
              {createContact.isPending && (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              )}
              Opret kontakt
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </FormShell>
  );
}

interface AktivitetFormProps extends FormBaseProps {
  contacts?: ContactSummary[];
  contactsLoading?: boolean;
  contactsError?: Error | null;
}

function AktivitetForm({
  companyId,
  companyName,
  contacts = [],
  contactsLoading = false,
  contactsError = null,
  onDone,
}: AktivitetFormProps) {
  const translate = useTranslate();
  const performer = usePerformerPicker();
  const followUpAssignee = useAssigneePicker();
  // Brief 84 §4: standard-modtager på ny opfølgning = viewSalesId.
  const viewSalesId = useViewSalesId();
  const [typeCode, setTypeCode] = useState<string>(
    String(AKTIVITET_TYPES[0].code),
  );
  const [date, setDate] = useState(todayIso());
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manualFollowUps, setManualFollowUps] = useState<ManualFollowUp[]>([]);
  const mutation = useRegisterAktivitet();
  const createContact = useCreateInlineContact();
  const [newContactName, setNewContactName] = useState("");

  const primaryContactId = contacts[0]?.id ?? null;
  const hasCustomerContacts = contacts.length > 0;
  const showInlineContactCreator =
    !contactsLoading &&
    !contactsError &&
    contacts.length === 0 &&
    manualFollowUps.length > 0;

  const handleCreateContactInline = () => {
    const trimmed = newContactName.trim();
    if (!trimmed) return;
    createContact.mutate(
      { companyId, companyName, name: trimmed },
      { onSuccess: () => setNewContactName("") },
    );
  };

  const submit = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError(translate("lago.registrer.empty_note_error"));
      return;
    }
    const codeNum = Number(typeCode);
    const chosen = AKTIVITET_TYPES.find((t) => t.code === codeNum);
    mutation.mutate(
      {
        companyId,
        companyName,
        activityTypeCode: codeNum,
        activityTypeLabel: chosen?.label ?? "Aktivitet",
        dateIso: date,
        description: trimmed,
        performedByName: performer.selectedName,
        performedBySalesId: performer.selectedSalesId,
        // Brief 40 tillæg A: manuelle opfølgninger + kontakt-binding
        // med samme skelne-mellem-tilstande regel som besøgsmutation.
        manualFollowUps: manualFollowUps.map((m) => ({
          text: m.text,
          dueDateIso: m.dueDateIso,
          assigneeSalesId: m.assigneeSalesId,
        })),
        primaryContactId,
        hasCustomerContacts,
        contactsFetchFailed: !!contactsError,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <FormShell
      onCancel={onDone}
      onSubmit={submit}
      submitLabel={translate("lago.registrer.aktivitet.submit")}
      submitting={mutation.isPending}
    >
      {/* Brief 22a #2 (rettet 16. sep 2026): native <input type="date">
          rendrer højere end SelectTrigger på grund af intern
          date-value-boks + kalender-ikon. Tving alle tre kontroller
          til samme højde med min-h-11 (44 px — designsystemets gulv
          for trykflader, jf. bridge.css). Rækken flugter, og
          date-value bliver ikke klemt. */}
      {/* Brief 42 §2: min-w-0 på grid-kolonner + w-full min-w-0 på
          input/select. Se BesoegForm ovenfor for begrundelse. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <Label className="text-sm">
            {translate("lago.registrer.aktivitet.type_label")}
          </Label>
          <Select value={typeCode} onValueChange={setTypeCode}>
            <SelectTrigger className="min-h-11 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AKTIVITET_TYPES.map((t) => (
                <SelectItem key={t.code} value={String(t.code)}>
                  {translate(t.labelKey, { _: t.label })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="akt-date" className="text-sm">
            {translate("lago.registrer.aktivitet.date_label")}
          </Label>
          {/* Brief 35 §1 (16. sep 2026): fremtidig dato tillades — det
              er sådan planlagte smagninger og samplings kommer i CRM'et.
              Ingen `max` her. */}
          <Input
            id="akt-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full min-w-0"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-sm">
            {translate("lago.registrer.aktivitet.performed_by_label")}
          </Label>
          <PerformerSelect
            state={performer}
            className="min-h-11 w-full min-w-0"
          />
        </div>
      </div>
      {/* Brief 35 §1: bekræftelse uden en ekstra kontrol. Linjen skifter
          med datoen — så en tastefejl i årstallet (2027 i stedet for
          2026) opdages med det samme. */}
      <p className="text-[13px] text-[var(--fg-2)]">
        {isPlannedDateIso(date)
          ? translate("lago.registrer.aktivitet.date_planned_hint", {
              _: "Registreres som planlagt — ikke afholdt endnu",
            })
          : translate("lago.registrer.aktivitet.date_done_hint", {
              _: "Registreres som afholdt",
            })}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="akt-note" className="text-sm font-bold">
          {translate("lago.registrer.aktivitet.note_label")}
        </Label>
        <Textarea
          id="akt-note"
          rows={5}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={translate("lago.registrer.aktivitet.note_placeholder")}
          className="text-sm"
        />
      </div>
      {/* Brief 40 tillæg A: samme inline-opfølgning som på Besøg-fanen.
          Sælgeren skal kunne notere en aftale i samme flow, uden at
          skifte til Opgave-fanen og finde kunden frem igen. */}
      <FollowUpBuilder
        items={manualFollowUps}
        onItemsChange={setManualFollowUps}
        assignableUsers={followUpAssignee.options}
        defaultAssigneeSalesId={viewSalesId}
      />
      {contactsLoading && manualFollowUps.length > 0 && (
        <p className="text-[13px] text-[var(--fg-2)]">
          <Icon icon={Loader2} size="sm" className="mr-1 inline animate-spin" />
          Henter kontakter så opfølgningen kan bindes…
        </p>
      )}
      {contactsError && manualFollowUps.length > 0 && (
        <p className="text-destructive text-sm">
          Kunne ikke hente kontakter — opfølgninger kan ikke bindes lige nu.
          Prøv at åbne kundens side og opdatere.
        </p>
      )}
      {showInlineContactCreator && (
        <div className="rounded-md border border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)] p-3">
          <p className="text-sm text-[var(--fg)]">
            Kunden har ingen kontakter endnu — opret én her, så bliver
            opfølgningen gemt på den.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Fornavn (og evt. efternavn)"
              className="min-h-11 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newContactName.trim()) {
                  e.preventDefault();
                  handleCreateContactInline();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="min-h-11 gap-1"
              onClick={handleCreateContactInline}
              disabled={createContact.isPending || !newContactName.trim()}
            >
              {createContact.isPending && (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              )}
              Opret kontakt
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </FormShell>
  );
}

interface WithContactsProps extends FormBaseProps {
  contacts: ContactSummary[];
  loading: boolean;
}

// Sentinel-value for "opret ny kontakt"-valget i Hvem?-vælgeren.
// Adskiller sig fra kontakt-id'ers tal-strings så vi kan skelne uden
// et separat "mode"-state.
const NEW_CONTACT = "__new__";

function contactFullName(c: ContactSummary): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    "(uden navn)"
  );
}

function OpgaveForm({
  companyId,
  companyName,
  contacts,
  loading,
  onDone,
}: WithContactsProps) {
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const assignee = useAssigneePicker();
  const [text, setText] = useState("");
  const [taskType, setTaskType] = useState<string>(DEFAULT_TASK_TYPE);
  const [dueDate, setDueDate] = useState(tomorrowIso());
  const [error, setError] = useState<string | null>(null);
  const mutation = useRegisterOpgave();

  // Brief 16. sep 2026: "Hvem?"-vælger med opret-inline. Default
  // vælger første eksisterende kontakt hvis der er en, ellers
  // NEW_CONTACT så sælgeren straks kan skrive et navn — 118 af 257
  // synlige kunder har ingen kontakt endnu.
  const defaultContactChoice =
    contacts.length > 0 ? String(contacts[0].id) : NEW_CONTACT;
  const [contactChoice, setContactChoice] =
    useState<string>(defaultContactChoice);
  const [newContactName, setNewContactName] = useState("");

  // Hvis kontakt-listen ankommer efter første render (contacts er tomt
  // ved mount, fyldes senere), snap default'en fra "ny" til første
  // eksisterende kontakt — kun hvis sælgeren ikke selv har valgt noget.
  useEffect(() => {
    if (
      contactChoice === NEW_CONTACT &&
      !newContactName.trim() &&
      contacts.length > 0
    ) {
      setContactChoice(String(contacts[0].id));
    }
  }, [contacts, contactChoice, newContactName]);

  const submit = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError(translate("lago.registrer.empty_note_error"));
      return;
    }

    // Resolve "Hvem?" til enten eksisterende contactId eller newContact.
    let contactId: number | null = null;
    let newContact: { firstName: string; lastName: string | null } | null =
      null;
    if (contactChoice === NEW_CONTACT) {
      const nameTrimmed = newContactName.trim();
      if (!nameTrimmed) {
        setError(
          translate("lago.registrer.opgave.new_contact_name_required", {
            _: "Skriv et navn på den nye kontakt",
          }),
        );
        return;
      }
      // Split ved SIDSTE mellemrum. "Martin Sandy Shalmi" →
      // ("Martin Sandy", "Shalmi"). Uden mellemrum ryger hele navnet
      // i first_name, og last_name er null. Samme regel bruges af
      // Kontakter-parseren og useCreateInlineContact.
      const { first_name: firstName, last_name: lastName } =
        splitNameAtLast(nameTrimmed);
      newContact = { firstName, lastName };
    } else {
      contactId = Number(contactChoice);
    }

    mutation.mutate(
      {
        companyId,
        companyName,
        contactId,
        newContact,
        text: trimmed,
        taskType,
        dueDateIso: dueDate,
        assigneeSalesId: assignee.selectedSalesId,
      },
      { onSuccess: onDone },
    );
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Icon icon={Loader2} className="animate-spin" /> …
      </div>
    );
  }

  return (
    <FormShell
      onCancel={onDone}
      onSubmit={submit}
      submitLabel={translate("lago.registrer.opgave.submit")}
      submitting={mutation.isPending}
    >
      <div className="space-y-1.5">
        <Label htmlFor="opg-text" className="text-sm font-bold">
          {translate("lago.registrer.opgave.text_label")}
        </Label>
        <Textarea
          id="opg-text"
          rows={3}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={translate("lago.registrer.opgave.text_placeholder")}
          className="text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="opg-hvem" className="text-sm">
          {translate("lago.registrer.opgave.contact_label", { _: "Hvem?" })}
        </Label>
        <Select value={contactChoice} onValueChange={setContactChoice}>
          <SelectTrigger id="opg-hvem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {contactFullName(c)}
                {c.title && (
                  <span className="text-muted-foreground ml-1 text-sm">
                    · {c.title}
                  </span>
                )}
              </SelectItem>
            ))}
            <SelectItem value={NEW_CONTACT}>
              {translate("lago.registrer.opgave.new_contact_option", {
                _: "+ Ny kontakt…",
              })}
            </SelectItem>
          </SelectContent>
        </Select>
        {contactChoice === NEW_CONTACT && (
          <Input
            autoFocus
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            placeholder={translate(
              "lago.registrer.opgave.new_contact_placeholder",
              { _: "Fornavn (og evt. efternavn)" },
            )}
            className="text-sm"
          />
        )}
      </div>
      {/* Brief 22a #2 + 42 §2: min-h-11 + min-w-0 + w-full på alle tre
          kontroller. Type/Forfald/Tildelt til passer ikke på tre kolonner
          uden krympning ved 375 px. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="opg-type" className="text-sm">
            {translate("lago.registrer.opgave.type_label")}
          </Label>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger id="opg-type" className="min-h-11 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="opg-due" className="text-sm">
            {translate("lago.registrer.opgave.due_label")}
          </Label>
          <Input
            id="opg-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="min-h-11 w-full min-w-0"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-sm">
            {translate("lago.registrer.opgave.assignee_label")}
          </Label>
          <AssigneeSelect
            state={assignee}
            className="min-h-11 w-full min-w-0"
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </FormShell>
  );
}

function NoteForm({
  companyId,
  companyName,
  contacts,
  loading,
  onDone,
}: WithContactsProps) {
  const translate = useTranslate();
  const [text, setText] = useState("");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRegisterNote();

  const submit = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError(translate("lago.registrer.empty_note_error"));
      return;
    }
    mutation.mutate(
      {
        companyId,
        companyName,
        text: trimmed,
        contactId: contactId === NO_CONTACT ? null : Number(contactId),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <FormShell
      onCancel={onDone}
      onSubmit={submit}
      submitLabel={translate("lago.registrer.note.submit")}
      submitting={mutation.isPending}
    >
      <p className="text-muted-foreground text-sm italic">
        {translate("lago.registrer.note.hint")}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="note-text" className="text-sm font-bold">
          {translate("lago.registrer.note.text_label")}
        </Label>
        <Textarea
          id="note-text"
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={translate("lago.registrer.note.text_placeholder")}
          className="text-sm"
        />
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">
          <Icon icon={Loader2} size="sm" className="inline animate-spin" />{" "}
          Henter kontakter…
        </p>
      ) : contacts.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="text-sm">
            {translate("lago.registrer.note.contact_label")}
          </Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CONTACT}>
                {translate("lago.registrer.note.contact_none")}
              </SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {contactLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </FormShell>
  );
}

// ---------------------------------------------------------------------
// Planlæg besøg — femte fane (brief 85 tillæg §b · 28. sep 2026).
// Genbruger usePlanNextVisit-mutation og useVisitIntervals ligesom
// PlanVisitDialog gør, men uden dialog-wrapperen så den kan leve inde
// i Registrér-modalens Tabs. Titlen på modalen ("Registrér på …") passer
// ikke på en planlagt aftale, så fanen har en tydelig indledning der
// gør klart: dette er fremtid, ikke fortid — "samme rail, forskellig
// tid-akse" (RegistrationRails egen formulering før den blev slettet).
// ---------------------------------------------------------------------

interface PlanleagFormProps {
  companyId: number;
  companyName: string;
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  currentPlannedIso?: string | null;
  currentNote?: string | null;
  onDone: () => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDateIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeIsoLocal(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function PlanleagForm({
  companyId,
  companyName,
  segment = null,
  currentPlannedIso = null,
  currentNote = null,
  onDone,
}: PlanleagFormProps) {
  const translate = useTranslate();
  const intervals = useVisitIntervals();
  const mutation = usePlanNextVisit();
  // §41c (1. okt 2026): planned_by = the person creating the plan, not
  // the customer's owner. If Peter plans a visit to Camilla's customer,
  // it is Peter's visit — it appears on his dashboard, not hers.
  const plannedBySalesId = useActorSalesId();

  const suggestion = (() => {
    if (segment === "A" || segment === "B" || segment === "C") {
      const days = intervals?.intervalDays?.[segment];
      if (typeof days === "number" && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return toLocalDateIsoLocal(d);
      }
    }
    return "";
  })();

  const initialDate = (() => {
    if (currentPlannedIso) {
      const d = new Date(currentPlannedIso);
      if (!Number.isNaN(d.getTime())) return toLocalDateIsoLocal(d);
    }
    return suggestion;
  })();
  const initialTime = (() => {
    if (currentPlannedIso) {
      const d = new Date(currentPlannedIso);
      if (!Number.isNaN(d.getTime())) {
        const hm = toLocalTimeIsoLocal(d);
        if (hm !== "00:00") return hm;
      }
    }
    return "";
  })();

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [note, setNote] = useState(currentNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!date) {
      setError(translate("lago.plan_visit.date_required"));
      return;
    }
    mutation.mutate(
      {
        companyId,
        companyName,
        dateIso: date,
        timeHm: time || null,
        note: note.trim() || null,
        plannedBySalesId,
      },
      { onSuccess: onDone },
    );
  };

  const clear = () => {
    setError(null);
    mutation.mutate(
      { companyId, companyName, dateIso: null },
      { onSuccess: onDone },
    );
  };

  const hasExisting = !!currentPlannedIso;

  return (
    <FormShell
      onCancel={onDone}
      onSubmit={submit}
      submitLabel={translate("lago.plan_visit.save")}
      submitting={mutation.isPending}
      extraAction={
        hasExisting
          ? {
              label: translate("lago.plan_visit.clear"),
              onClick: clear,
              disabled: mutation.isPending,
            }
          : undefined
      }
    >
      {/* Brief 85 tillæg §b: tydelig indledning — modalens overskrift
          siger "Registrér på %{name}", og planlægning er ikke en
          registrering. Fanen selv gør det klart at det er fremtid. */}
      <div className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
        {translate("lago.plan_visit.tab_intro", {
          _: "Planlæg fremtidigt besøg — dette registrerer ikke noget der er sket.",
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="plan-tab-date" className="text-sm">
            {translate("lago.plan_visit.date_label")}
          </Label>
          <Input
            id="plan-tab-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {suggestion && date === suggestion && !hasExisting && (
            <p className="text-muted-foreground text-sm">
              {translate("lago.plan_visit.suggestion_hint", {
                segment: segment ?? "?",
              })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-tab-time" className="text-sm">
            {translate("lago.plan_visit.time_label")}
          </Label>
          <Input
            id="plan-tab-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plan-tab-note" className="text-sm">
          {translate("lago.plan_visit.note_label")}
        </Label>
        <Textarea
          id="plan-tab-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={translate("lago.plan_visit.note_placeholder")}
          className="text-sm"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </FormShell>
  );
}

// ---------------------------------------------------------------------
// Shared form shell (footer + spacing)
// ---------------------------------------------------------------------

function FormShell({
  children,
  onCancel,
  onSubmit,
  submitLabel,
  submitting,
  extraAction,
}: {
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting: boolean;
  /** Optional secondary CTA. Brief 15: BesoegForm bruger den til
   *  "Registrér & planlæg næste" — samme flow, ét klik videre. */
  extraAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}) {
  const translate = useTranslate();
  // Brief 42 §3+§4 (16. sep 2026): hele modalen ruller nu — DialogContent
  // har overflow-y-auto, og form-elementet fylder bare sin naturlige
  // højde. Ingen sticky-footer, ingen flex-min-h-0 inde i formen. Det
  // løser samtidig at notefeltets rows={5} blev klemt af intern flex.
  // §4: Annullér er en tekst-link i --fg-2, ikke en fuld-bredde knap.
  // Tre lige brede kasser gav ingen primær handling (tillæg A §0 til
  // brief 34) — Gem vinder nu synligt.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col"
    >
      <div className="space-y-4 px-6 pt-4 pb-4">{children}</div>
      <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
        >
          {translate("lago.registrer.cancel")}
        </button>
        {extraAction && (
          <Button
            type="button"
            variant="outline"
            disabled={submitting || extraAction.disabled}
            onClick={extraAction.onClick}
            className="gap-2"
          >
            <Icon icon={CalendarClock} size="sm" />
            {extraAction.label}
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting}
          className={cn(
            "min-w-[120px] gap-2",
            // Brief 20 pkt 2 + audit 10. sep: accent-deep (4.83:1),
            // ikke --a (2.94:1 hvid tekst på --a bryder WCAG AA)
            "bg-[var(--a-deep)] text-white hover:bg-[var(--a-deep)]/90 focus-visible:ring-[var(--a)]/40",
          )}
        >
          {submitting && <Icon icon={Loader2} className="animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------
// Shared "hvem"-pickers — "Udført af" for Besøg/Aktivitet, "Tildelt til"
// for Opgave. Both hooks own a stable options-list + selected key state
// with the current user pre-selected, and the paired <Select>-component
// keeps the JSX tight so each form only says the label once.
// ---------------------------------------------------------------------

interface PickerState {
  options: AssignableUser[];
  selectedKey: string;
  setSelectedKey: (v: string) => void;
  selected: AssignableUser | null;
  selectedName: string | null;
  selectedSalesId: number | null;
  isLoading: boolean;
}

function useAssignableState(opts: {
  includeBackoffice?: boolean;
  /** Brief 20 pkt 5: udelad service-konti ("System", "Webshop") fra
   *  "Udført af" — de kan ikke have udført et kundebesøg. De må stadig
   *  optræde som "Tildelt til" på opgaver (Backoffice-kø-analogt). */
  excludeServiceAccounts?: boolean;
}): PickerState {
  const { options, me, isLoading } = useAssignableUsers({
    includeBackoffice: opts.includeBackoffice,
  });
  const filteredOptions = opts.excludeServiceAccounts
    ? options.filter((o) => o.name !== "System" && o.name !== "Webshop")
    : options;
  const [selectedKey, setSelectedKey] = useState<string>(() => me?.key ?? "");

  // If the identity/user list arrives after the initial render, snap the
  // default to "Mig" once it materialises. Ignores explicit user picks.
  useEffect(() => {
    if (!selectedKey && me) setSelectedKey(me.key);
  }, [me, selectedKey]);

  const selected = filteredOptions.find((o) => o.key === selectedKey) ?? null;
  return {
    options: filteredOptions,
    selectedKey,
    setSelectedKey,
    selected,
    selectedName: selected?.name ?? null,
    selectedSalesId: selected?.salesId ?? null,
    isLoading,
  };
}

function usePerformerPicker() {
  return useAssignableState({ excludeServiceAccounts: true });
}

function useAssigneePicker() {
  return useAssignableState({ includeBackoffice: true });
}

function PerformerSelect({
  state,
  className,
}: {
  state: PickerState;
  className?: string;
}) {
  return <AssignableSelect state={state} className={className} />;
}

function AssigneeSelect({
  state,
  className,
}: {
  state: PickerState;
  className?: string;
}) {
  return <AssignableSelect state={state} className={className} />;
}

function AssignableSelect({
  state,
  className,
}: {
  state: PickerState;
  className?: string;
}) {
  return (
    <Select value={state.selectedKey} onValueChange={state.setSelectedKey}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {state.options.map((o) => {
          // Brief 42-korrektur (16. sep 2026): sælgere uden login kan
          // ikke modtage opgaver — pickeren viste dem tidligere som var
          // de valgbare, og en tildeling til dem havnede i Backoffice-
          // køen uden at nogen så det. Nu grå og uvalgbare, med suffix
          // der forklarer hvorfor. Backoffice er stadig valgbar — den
          // ER kø-optionen, ikke et menneske uden invitation.
          const isDisabled = o.kind === "user" && !o.hasLogin;
          return (
            <SelectItem key={o.key} value={o.key} disabled={isDisabled}>
              <span className="flex items-center gap-1.5">
                {o.name}
                {o.kind === "me" && (
                  <span className="text-muted-foreground text-sm">(mig)</span>
                )}
                {o.kind === "backoffice" && (
                  <span className="text-muted-foreground text-sm">(kø)</span>
                )}
                {isDisabled && (
                  <span className="text-muted-foreground text-sm">
                    (ingen invitation endnu)
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Utility: build a hook-like state pair for controlled open/close from
// consumer components. Not used internally — exported for API symmetry.
export function useRegistrerModal(initial = false) {
  return useState(initial);
}

export type { TabKey };
export { AKTIVITET_TYPES as REGISTRER_AKTIVITET_TYPES };
