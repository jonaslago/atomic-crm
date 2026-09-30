import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetIdentity, useTranslate } from "ra-core";
import { Link } from "react-router-dom";
import { MapPin, Pencil, Phone, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";

import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { useSoftDeleteActivity } from "@/lago/registrer/mutations";
import {
  fetchOrdreKommentarerForCompany,
  HENSIGT_LABEL,
  type OrdreKommentar,
} from "@/lago/customers/ordreKommentarer";
import { OrdreKommentarDialog } from "./OrdreKommentarDialog";
import { EditActivityDialog } from "@/lago/registrer/EditActivityDialog";
import { RowActionsMenu } from "@/lago/dashboard/RowActionsMenu";

import { Icon } from "@/lago/ui/Icon";
import { IconButton } from "@/lago/ui/IconButton";
import { Meta } from "@/lago/ui/Meta";
import { RowGroup } from "@/lago/ui/RowGroup";
import { SectionHeader } from "@/lago/ui/SectionHeader";
import { StatusBadge } from "@/lago/ui/StatusBadge";
import { Button as LagoButton } from "@/lago/ui/Button";
import { formatPhonePairs } from "@/lago/ui/formatPhone";

import { useSalesYtd, formatYtdPeriod } from "../salgstal/useSalesYtd";
import { useSellerLookup } from "@/lago/settings/useSellerLookup";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";
import type {
  CompanyLagoExtension,
  ContactSummary,
  LagoCustomerData,
  OpenTask,
} from "../types";
import { ContactDialog } from "./ContactDialog";
import { DetaljerDialog } from "./DetaljerDialog";
import { ExpandableNote } from "@/lago/ui/ExpandableNote";
import { plural } from "@/lago/ui/plural";

import { BesoegsfrekvensDialog } from "./BesoegsfrekvensDialog";
import { EditNoteDialog } from "./EditNoteDialog";
import { RingelisteLukDialog } from "../list/RingelisteLukDialog";
import { SaesonlukketDialog } from "./SaesonlukketDialog";
import { SletNoteDialog } from "./SletNoteDialog";
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import { ProposeChangeButton } from "./ProposeChangeDialog";
import {
  useOpenOrders,
  type OpenOrderLine,
  type OpenOrderSummary,
} from "./useOpenOrders";

/**
 * Brief 45 (16. sep 2026) · kundekortets læse-rækkefølge efter Stitch.
 *
 * Stitchs otte sektioner. Sektion 1 (kundeoverblik) og sektion 2
 * (handlingsrækken) ligger allerede i CustomerHeader/CustomerActionBar
 * — den sticky action-bar er bevaret (brief 45 §5). Dette komponent
 * står for sektion 3–8 i den rigtige rækkefølge:
 *
 *   3. Hvad skete der sidst (afholdte aktiviteter · noter · opkald)
 *   4. Åbne opfølgninger   (åbne tasks — løfter, ikke spor)
 *   5. Kontaktpersoner
 *   6. Omsætning
 *   7. Åbne ordrer
 *   8. Stamdata
 *
 * En sælger i en dør skal vide, hvad der skete sidst — ikke
 * postnummeret. Stamdata står nederst med vilje.
 *
 * Kundekortet bruger skillelinjer, ikke paneler (brief 45 §2). Et
 * panel er noget man handler på; kundekortet er et dokument man læser.
 */

const kroner = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

function contactName(c: ContactSummary): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    `Kontakt #${c.id}`
  );
}

function contactPrimaryPhone(c: ContactSummary): string | null {
  return c.phone_jsonb?.[0]?.number ?? null;
}

function contactPrimaryEmail(c: ContactSummary): string | null {
  return c.email_jsonb?.[0]?.email ?? null;
}

function dateShort(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export type SectionLayout = "mobile" | "laptop";

export function LagoCustomerCard({ data }: { data: LagoCustomerData }) {
  // Brief 50 §2 (17. sep 2026): KundeoverbikkSection er ude af mobil-
  // kortet — MobileHeader ér overblikket nu. Sektionen bevares som
  // eksport (KundeoverbikkSection), fordi den er en gyldig
  // sammensætning hvis fremtidig brug kræver det.
  return (
    <div className="flex flex-col">
      <HvadSketeDerSidstSection data={data} />
      <AabneOpfoelgningerSection
        tasks={data.openTasks}
        contacts={data.contacts}
      />
      <KontaktpersonerSection
        companyId={data.company.id}
        companyName={data.company.name}
        contacts={data.contacts}
      />
      <OmsaetningSection extension={data.extension} />
      <AabneOrdrerSection
        extension={data.extension}
        companyId={data.company.id}
        companyName={data.company.name}
      />
      <StamdataSection data={data} />
    </div>
  );
}

// ------------------------------------------------------------------
// 0. Kundeoverblik — Brief 48 §A (16. sep 2026)
// ------------------------------------------------------------------

/**
 * Kundeoverblik-sektion mellem topbjælken og læse-sektionerne. Navn
 * gentages fra topbjælken (bevidst dublering — Stitchs opsætning har
 * samme), segment højre, adresse under med lille pin-ikon. Uden denne
 * stod adressen otte sektioner nede i Stamdata; en sælger i en dør
 * skulle rulle for at få den. Nu er den synlig ved page-load.
 */
export function KundeoverbikkSection({ data }: { data: LagoCustomerData }) {
  const { company, extension } = data;
  // Brief 37 §5 (bevaret): adressen udelader land — alle kunder er
  // danske, "Danmark" bag byen er ren støj.
  const address = [company.address, company.zipcode, company.city]
    .filter(Boolean)
    .join(" · ");
  return (
    <Section>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[length:var(--t-title)] font-bold tracking-tight text-[var(--fg)] leading-tight">
          {company.name}
        </h2>
        {extension?.segment && (
          <StatusBadge variant="neutral">
            Segment {extension.segment}
          </StatusBadge>
        )}
      </div>
      {address && (
        <p className="mt-2 flex items-center gap-1.5 text-[length:var(--t-sec)] text-[var(--fg-2)]">
          <Icon
            icon={MapPin}
            size="sm"
            className="shrink-0 text-[var(--fg-3)]"
          />
          <span className="truncate">{address}</span>
        </p>
      )}
    </Section>
  );
}

/** En sektion. To varianter:
 *
 *  - `divider` (default): skillelinjer mellem sektionerne, ingen ramme.
 *    Brief 45 §2 — mobil-kundekortet er et dokument man læser.
 *  - `panel`: hvidt kort med padding og radius. Brief 49 §3 — laptop-
 *    kundekortet er to spalter med kort; matcher Stitchs opsætning
 *    hvor `bg-surface-container-lowest p-space-lg` bruges pr. sektion.
 */
export type SectionVariant = "divider" | "panel";

export function Section({
  children,
  isLast = false,
  variant = "divider",
  className,
  id,
}: {
  children: React.ReactNode;
  isLast?: boolean;
  variant?: SectionVariant;
  className?: string;
  id?: string;
}) {
  if (variant === "panel") {
    return (
      <section
        id={id}
        className={cn(
          "bg-[var(--surface)] rounded-[var(--r-2)] p-4 mb-4 last:mb-0",
          className,
        )}
      >
        {children}
      </section>
    );
  }
  return (
    <section
      id={id}
      className={cn(
        "py-5",
        !isLast && "border-b border-[var(--line)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

// ------------------------------------------------------------------
// 3. Hvad skete der sidst
// ------------------------------------------------------------------

const HVAD_SKETE_INITIAL = 5;

export function HvadSketeDerSidstSection({
  data,
  layout = "mobile",
}: {
  data: LagoCustomerData;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const translate = useTranslate();
  const { taskTypes } = useConfigurationContext();
  const { data: identity } = useGetIdentity();
  const { isAdmin } = useIsLagoAdmin();
  const softDelete = useSoftDeleteActivity();
  const currentSalesId =
    identity && typeof identity.id === "number" ? identity.id : null;

  const [editRow, setEditRow] = useState<{
    id: number;
    company_id: number;
    activity_date: string;
    activity_type_code: number | null;
    description: string | null;
  } | null>(null);
  // Brief 87 audit-svar #3 (28. sep 2026): sletning kræver dialog, alle
  // bredder. Ingen ny komponent — shadcn Dialog inline. Kortlægges hvis
  // aktiviteten er en andens (admin på Peters række): navngiv ejeren.
  const [deleteRow, setDeleteRow] = useState<{
    id: number;
    text: string;
    ownerName: string | null;
  } | null>(null);
  // Sletteregler (29. sep 2026): egne dialog-tilstande for noter så
  // aktivitetens slet-dialog ikke skal håndtere begrundelse-feltet.
  const [editNoteRow, setEditNoteRow] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [sletNoteRow, setSletNoteRow] = useState<{
    id: number;
    text: string;
    isSomeoneElses: boolean;
    ownerName: string | null;
  } | null>(null);
  // Brief 48 §D (16. sep 2026): "Hvad skete der sidst" — ikke "alt hvad
  // der nogensinde er sket". Vis 5 nyeste, "Se alle N" folder resten ud
  // i-place når man vil se hele historikken.
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    // Brief 45 §3: kun HISTORIK. Planlagte aktiviteter (isPlanned)
    // hører i "Åbne opfølgninger" nedenfor — et løfte er ikke et spor.
    const activityRows = (data.activities ?? [])
      .filter((a) => a.done === true)
      .map((a) => ({
        id: `activity-${a.id}`,
        kind: (a.activity_type_code === 1
          ? "Besøg"
          : a.activity_type || "Aktivitet") as string,
        salesName: a.sales_name ?? null,
        date: a.activity_date,
        detail: a.description ?? null,
        raw: { __kind: "activity" as const, ...a },
      }));
    // Noter, der er skrevet på kunden (uden en tilknyttet task), er
    // også en del af historikken. Sletteregler (29. sep 2026): raw
    // bærer nu noten selv, så canEditNote og rowActions kan bruge id
    // og sales_id — før var raw null, og noter fik ingen handlinger.
    const noteRows = data.notes.map((n) => ({
      id: `note-${n.id}`,
      kind: "Note" as string,
      salesName: null as string | null,
      date: n.created_at,
      detail: n.text,
      raw: {
        __kind: "note" as const,
        id: n.id,
        company_id: n.company_id,
        sales_id: n.sales_id ?? null,
        text: n.text,
      },
    }));
    return [...activityRows, ...noteRows].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }, [data.activities, data.notes, taskTypes]);

  const canEditActivity = (raw: (typeof rows)[number]["raw"]) => {
    if (!raw || raw.__kind !== "activity") return false;
    return (
      raw.source === "crm_native" &&
      (isAdmin || (currentSalesId != null && raw.sales_id === currentSalesId))
    );
  };

  // Sletteregler (29. sep 2026): noter er altid CRM-native — de kan
  // ikke komme fra VISMA. Ejer eller admin må redigere og slette.
  const canEditNote = (raw: (typeof rows)[number]["raw"]) => {
    if (!raw || raw.__kind !== "note") return false;
    return (
      isAdmin || (currentSalesId != null && raw.sales_id === currentSalesId)
    );
  };

  const visibleRows = expanded ? rows : rows.slice(0, HVAD_SKETE_INITIAL);
  const hiddenCount = Math.max(0, rows.length - HVAD_SKETE_INITIAL);
  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      {isLaptop ? (
        <SectionHeader
          variant="label"
          title="Aktivitetshistorik"
          subtitle={
            rows.length > 0
              ? plural(rows.length, "aktivitet", "aktiviteter")
              : undefined
          }
        />
      ) : (
        <SectionHeader
          title="Hvad skete der sidst"
          right={
            rows.length > 0 && (
              <Meta>{plural(rows.length, "aktivitet", "aktiviteter")}</Meta>
            )
          }
        />
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--fg-2)]">
          {translate("lago.customer.empty.no_timeline", {
            _: "Ingen aktiviteter registreret endnu.",
          })}
        </p>
      ) : (
        <RowGroup>
          {visibleRows.map((r) => {
            const rowActions = [];
            if (
              r.raw &&
              r.raw.__kind === "activity" &&
              canEditActivity(r.raw)
            ) {
              rowActions.push({
                label: "Redigér",
                onSelect: () =>
                  setEditRow({
                    id: r.raw!.id,
                    company_id: r.raw!.company_id,
                    activity_date: r.raw!.activity_date,
                    activity_type_code: r.raw!.activity_type_code,
                    description: r.raw!.description,
                  }),
              });
              rowActions.push({
                label: "Slet",
                // Brief 87 audit-svar #3: åbner dialog, sletter ikke direkte.
                onSelect: () => {
                  const owner =
                    currentSalesId != null &&
                    r.raw?.sales_id != null &&
                    r.raw.sales_id !== currentSalesId
                      ? (r.raw.sales_name ?? null)
                      : null;
                  setDeleteRow({
                    id: r.raw!.id,
                    text: r.detail?.trim() || r.kind,
                    ownerName: owner,
                  });
                },
                destructive: true,
              });
            }
            // Sletteregler (29. sep 2026): noter fik ingen handlinger
            // før — canEditActivity krævede source='crm_native' og note-
            // raw havde ingen source. canEditNote parallelliserer reglen.
            if (r.raw && r.raw.__kind === "note" && canEditNote(r.raw)) {
              const noteRaw = r.raw;
              rowActions.push({
                label: "Redigér",
                onSelect: () =>
                  setEditNoteRow({ id: noteRaw.id, text: noteRaw.text }),
              });
              rowActions.push({
                label: "Slet",
                onSelect: () => {
                  const isSomeoneElses =
                    currentSalesId != null &&
                    noteRaw.sales_id != null &&
                    noteRaw.sales_id !== currentSalesId;
                  setSletNoteRow({
                    id: noteRaw.id,
                    text: noteRaw.text,
                    isSomeoneElses,
                    // Note: sales_name-lookup mangler et sted at slå op —
                    // vi har kun sales_id på noten. Kort tekst "en anden"
                    // bruges indtil useSellerLookup passes ned; ingen risk
                    // for stille sletning fordi begrundelse-feltet
                    // stadig er påkrævet.
                    ownerName: isSomeoneElses ? "en anden" : null,
                  });
                },
                destructive: true,
              });
            }
            return (
              <li key={r.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--fg)]">
                    {r.kind}
                    {r.salesName && (
                      <span className="text-[var(--fg-2)]">
                        {" "}
                        · {r.salesName}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <time className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      {dateShort(r.date)}
                    </time>
                    {rowActions.length > 0 && (
                      <RowActionsMenu
                        ariaLabel="Flere handlinger"
                        actions={rowActions}
                      />
                    )}
                  </div>
                </div>
                {r.detail && (
                  <ExpandableNote
                    text={r.detail}
                    className="text-sm text-[var(--fg-2)]"
                  />
                )}
              </li>
            );
          })}
        </RowGroup>
      )}
      {/* Brief 48 §D: "Se alle N" folder resten ud i-place. Vi
          navigerer ikke væk — sælgeren skal ikke miste konteksten på
          kundekortet. Klik igen for at klappe sammen. */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[length:var(--t-sec)] font-medium text-[var(--fg-2)] hover:text-[var(--fg)] underline-offset-2 hover:underline"
        >
          {expanded ? "Vis færre" : `Se alle ${rows.length} →`}
        </button>
      )}
      {editRow && (
        <EditActivityDialog
          open={editRow != null}
          onOpenChange={(v) => !v && setEditRow(null)}
          activity={editRow}
          companyName={data.company.name}
          lastVisitWithoutThis={null}
        />
      )}
      {editNoteRow && (
        <EditNoteDialog
          open={editNoteRow != null}
          onOpenChange={(v) => !v && setEditNoteRow(null)}
          noteId={editNoteRow.id}
          companyId={data.company.id}
          initialText={editNoteRow.text}
        />
      )}
      {sletNoteRow && (
        <SletNoteDialog
          open={sletNoteRow != null}
          onOpenChange={(v) => !v && setSletNoteRow(null)}
          noteId={sletNoteRow.id}
          companyId={data.company.id}
          noteText={sletNoteRow.text}
          isSomeoneElses={sletNoteRow.isSomeoneElses}
          ownerName={sletNoteRow.ownerName}
        />
      )}
      {/* Brief 87 audit-svar #3 (28. sep 2026): slet-dialog, alle bredder.
          Navngiver aktivitetens tekst; under admin på en andens række
          også ejeren. Slet er destruktiv rød, Fortryd sekundær. */}
      <Dialog
        open={deleteRow != null}
        onOpenChange={(v) => !v && setDeleteRow(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Slet aktivitet?</DialogTitle>
            <DialogDescription>
              Aktiviteten forsvinder fra kunden. Kan fortrydes i toast'en de
              næste 5 sekunder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <div className="text-[13px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
                Aktivitet
              </div>
              <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--fg)]">
                {deleteRow?.text || "(uden tekst)"}
              </p>
            </div>
            {deleteRow?.ownerName && (
              <p className="rounded-md bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--fg-2)]">
                Dette er {deleteRow.ownerName}s aktivitet.
              </p>
            )}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={softDelete.isPending}
            >
              Fortryd
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!deleteRow) return;
                const id = deleteRow.id;
                setDeleteRow(null);
                softDelete.mutate({
                  activityId: id,
                  companyId: data.company.id,
                  companyName: data.company.name,
                });
              }}
              disabled={softDelete.isPending}
              className="bg-[var(--st-red-fg)] text-white hover:bg-[var(--st-red-fg)]/90"
            >
              Slet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ------------------------------------------------------------------
// 4. Åbne opfølgninger
// ------------------------------------------------------------------

export function AabneOpfoelgningerSection({
  tasks,
  contacts,
  layout = "mobile",
}: {
  tasks: OpenTask[];
  contacts: ContactSummary[];
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const { taskTypes } = useConfigurationContext();
  const sellers = useSellerLookup();
  // Brief 45 §3: gul StatusBadge når der er nogen. Neutral ellers.
  const count = tasks.length;
  // Brief 52 tillæg A §3 (17. sep 2026): gult "N udestående" mærkat
  // begge bredder — laptop sagde grå "N aktive", som ikke sagde
  // hvad der skulle handles på. Ét sprog, én farve, begge steder.
  const badge =
    count > 0 ? (
      <StatusBadge variant="gul">{count} udestående</StatusBadge>
    ) : (
      <Meta>Ingen udestående</Meta>
    );
  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      {isLaptop ? (
        <SectionHeader
          variant="label"
          title="Åbne opfølgninger"
          right={badge}
        />
      ) : (
        <SectionHeader title="Åbne opfølgninger" right={badge} />
      )}
      {count === 0 ? (
        <p className="text-sm text-[var(--fg-2)]">
          Alle løfter er indfriet. Godt gået.
        </p>
      ) : (
        <RowGroup>
          {tasks.map((t) => {
            const contact = contacts.find((c) => c.id === t.contact_id);
            // Brief 48 §C (16. sep 2026): rækken viser ANSVARLIG frem
            // for type. Hvem der skylder noget er vigtigere end hvordan
            // det skal gøres — især når opgaver kan ligge i kontorets
            // kø. Ukendt sales_id (kontor-opgaver o.l.) → "Kontoret".
            // Type flyttes bag ⋯ som tooltip på rækken.
            const typeLabel =
              taskTypes.find((tt) => tt.value === t.type)?.label ??
              t.type ??
              null;
            const responsibleName = sellers.bySalesId(t.sales_id) ?? "Kontoret";
            const overdue =
              t.due_date != null &&
              t.due_date < new Date().toISOString().slice(0, 10);
            return (
              <li
                key={t.id}
                className="flex flex-col gap-1"
                title={typeLabel ? `Type: ${typeLabel}` : undefined}
              >
                <p className="text-sm font-medium text-[var(--fg)]">{t.text}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--t-sec)] text-[var(--fg-2)]">
                  {t.due_date && (
                    <span
                      className={
                        overdue
                          ? "font-medium text-[var(--st-red-fg)]"
                          : "text-[var(--st-amber-fg)]"
                      }
                    >
                      Forfald: {dateShort(t.due_date)}
                    </span>
                  )}
                  <span>Ansvarlig: {responsibleName}</span>
                  {contact && <span>Kontakt: {contactName(contact)}</span>}
                </div>
              </li>
            );
          })}
        </RowGroup>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------
// 5. Kontaktpersoner
// ------------------------------------------------------------------

export function KontaktpersonerSection({
  companyId,
  companyName,
  contacts,
  layout = "mobile",
}: {
  companyId: number;
  companyName?: string;
  contacts: ContactSummary[];
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const [dialogTarget, setDialogTarget] = useState<"new" | number | null>(null);
  const count = contacts.length;
  const addButton = (
    <LagoButton
      variant="secondary"
      icon={Plus}
      onClick={() => setDialogTarget("new")}
    >
      Tilføj
    </LagoButton>
  );
  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      {isLaptop ? (
        <SectionHeader
          variant="label"
          title="Kontaktpersoner"
          subtitle={
            count > 0
              ? `${count} ${count === 1 ? "person" : "personer"}`
              : undefined
          }
          action={addButton}
        />
      ) : (
        <SectionHeader
          title="Kontaktpersoner"
          right={
            <div className="flex items-center gap-2">
              {count > 0 && (
                <Meta>
                  {count} {count === 1 ? "person" : "personer"}
                </Meta>
              )}
              {addButton}
            </div>
          }
        />
      )}
      {count === 0 ? (
        <p className="text-sm text-[var(--fg-2)]">
          Ingen kontaktpersoner endnu. Klik Tilføj for at oprette en.
        </p>
      ) : (
        <RowGroup>
          {contacts.map((c) => {
            const email = contactPrimaryEmail(c);
            const phone = contactPrimaryPhone(c);
            return (
              <li
                key={c.id}
                className="group flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/contacts/${c.id}/show`}
                      className="text-sm font-medium text-[var(--fg)] no-underline hover:underline"
                    >
                      {contactName(c)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDialogTarget(c.id)}
                      aria-label={`Redigér ${contactName(c)}`}
                      title="Redigér"
                      /* Brief 53 §0 (17. sep 2026): synlig hele tiden
                         på tablet/telefon (ingen mus). På mus+trackpad
                         skjult indtil group-hover eller focus.
                         (hover:hover) matcher kun hover-capable enheder;
                         (pointer:fine) matcher kun præcis pointer. */
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-3)] hover:bg-[var(--surface-3)] hover:text-[var(--fg-2)] [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100"
                    >
                      <Icon icon={Pencil} size="sm" />
                    </button>
                  </div>
                  {/* Brief 51 §2 (17. sep 2026): telefonnummeret som
                      TEKST — ikke kun en ring-knap. "Man skal kunne
                      læse et nummer op i telefonen til en kollega."
                      Nummer i par (formatPhonePairs) så otte cifre
                      kan skimtes i en bildør. */}
                  {(c.title || phone) && (
                    <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
                      {c.title}
                      {c.title && phone && <span aria-hidden> · </span>}
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="text-[var(--ink)] underline-offset-2 hover:underline"
                        >
                          {formatPhonePairs(phone)}
                        </a>
                      )}
                    </p>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="text-[length:var(--t-meta)] text-[var(--fg-3)] hover:underline"
                    >
                      {email}
                    </a>
                  )}
                </div>
                {phone && (
                  <IconButton
                    icon={Phone}
                    aria-label={`Ring til ${contactName(c)}`}
                    onClick={() => {
                      window.location.href = `tel:${phone}`;
                    }}
                  />
                )}
              </li>
            );
          })}
        </RowGroup>
      )}
      <ContactDialog
        open={dialogTarget !== null}
        onOpenChange={(v) => !v && setDialogTarget(null)}
        companyId={companyId}
        companyName={companyName}
        contactId={typeof dialogTarget === "number" ? dialogTarget : null}
      />
    </Section>
  );
}

// ------------------------------------------------------------------
// 6. Omsætning
// ------------------------------------------------------------------

export function OmsaetningSection({
  extension,
  layout = "mobile",
}: {
  extension: CompanyLagoExtension | null;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const query = useSalesYtd(extension?.visma_customer_no ?? null);
  const data = query.data;
  // §30b: open orders total + klar amount shown in the revenue box.
  // useOpenOrders is already cached from AabneOrdrerSection below.
  const ordreQuery = useOpenOrders(extension?.visma_customer_no ?? null);
  const ordreTotal =
    ordreQuery.data?.orders?.reduce((s, o) => s + o.total, 0) ?? 0;
  // §32a: "klar" = only orders in the "Klar til levering – uden aftale"
  // bucket (no MAV, no date, status=klar, not En Primeur).
  const ordreKlar =
    ordreQuery.data?.orders
      ?.filter((o) => bucketFor(o) === "klar")
      .reduce((s, o) => s + o.total, 0) ?? 0;
  const hasOrdrer = (ordreQuery.data?.orders?.length ?? 0) > 0;

  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      {isLaptop ? (
        <SectionHeader variant="label" title="Omsætning" />
      ) : (
        <SectionHeader title="Omsætning" right={<Meta>Sammenligning</Meta>} />
      )}
      {!extension?.visma_customer_no ? (
        <p className="text-sm text-[var(--fg-2)]">
          Kunden har intet VISMA-kundenummer — ingen salgstal.
        </p>
      ) : query.isPending ? (
        <p className="text-sm text-[var(--fg-2)]">Henter salgstal …</p>
      ) : query.error ? (
        <p className="text-sm text-[var(--st-red-fg)]">
          Kunne ikke hente salgstal.
        </p>
      ) : data ? (
        (() => {
          // Brief 50 §4 (17. sep 2026): ÅTD står stort. "Sidste år
          // (samme tid)" er mindre (--t-body 600) — det er ballast
          // for i år, ikke ligeværdigt. Forskellen i BÅDE kroner og
          // procent så tallet kan sammenlignes på tværs af kunder.
          const diffKr = data.ytdThisYear - data.ytdLastYear;
          const diffPct =
            data.ytdLastYear > 0 ? (diffKr / data.ytdLastYear) * 100 : null;
          const pctNumber = new Intl.NumberFormat("da-DK", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
          const pctText =
            diffPct != null
              ? `(${diffPct >= 0 ? "+" : ""}${pctNumber.format(diffPct)} %)`
              : null;
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                    ÅTD ({formatYtdPeriod(data.throughMonth)})
                  </span>
                  <span className="text-[length:var(--t-title)] font-bold text-[var(--fg)] tabular-nums">
                    {kroner.format(data.ytdThisYear)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                    {/* §30d: "hele måneden med" until daily grain is built. */}
                    Sidste år (hele måneden med)
                  </span>
                  <span className="text-[length:var(--t-body)] font-semibold text-[var(--fg-2)] tabular-nums">
                    {kroner.format(data.ytdLastYear)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--fg-2)]">Forskel:</span>
                {/* Brief 50 §4: elementet indpakket i <span> så en fremtidig
                    rapport-link kan drape sig om det uden refaktor. */}
                <span
                  className={cn(
                    "text-[length:var(--t-sec)] font-medium tabular-nums",
                    diffKr >= 0
                      ? "text-[var(--st-green-fg)]"
                      : "text-[var(--st-red-fg)]",
                  )}
                >
                  {diffKr >= 0 ? "+" : ""}
                  {kroner.format(diffKr)}
                  {pctText && <span className="ml-2">{pctText}</span>}
                </span>
              </div>
              {/* §30b: open orders as a third size in the revenue box.
                  Separated by --line to show it is not revenue (yet).
                  §30c: amount links to the Åbne ordrer section. */}
              {hasOrdrer && (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      Åbne ordrer
                    </span>
                    <a
                      href="#aabne-ordrer"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("aabne-ordrer")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="text-[length:var(--t-body)] font-semibold text-[var(--fg)] tabular-nums underline-offset-2 hover:underline"
                    >
                      {kroner.format(ordreTotal)}
                    </a>
                  </div>
                  {ordreKlar > 0 && (
                    <p className="mt-0.5 text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      heraf klar {kroner.format(ordreKlar)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()
      ) : null}
    </Section>
  );
}

// ------------------------------------------------------------------
// 7. Åbne ordrer
// ------------------------------------------------------------------

// §32a: six buckets — first matching rule wins, in this order.
type BucketKey =
  | "en_primeur"
  | "afventer"
  | "reservation"
  | "aftalt_mav"
  | "aftalt_dato"
  | "klar";
// §32h: date before MAV in display order too.
const BUCKET_ORDER: BucketKey[] = [
  "klar",
  "aftalt_mav",
  "aftalt_dato",
  "reservation",
  "afventer",
  "en_primeur",
];
const BUCKET_LABEL: Record<BucketKey, string> = {
  en_primeur: "En Primeur",
  afventer: "Afventer ankomst af varer",
  reservation: "I reservation",
  aftalt_mav: "Aftalt levering – med andre varer",
  aftalt_dato: "Aftalt levering – med dato",
  klar: "Klar til levering – uden aftale",
};
// §38c: short explanation per bucket — must be true for us.
const BUCKET_HINT: Record<BucketKey, string> = {
  afventer: "mindst én linje mangler",
  aftalt_dato: "dato aftalt med kunden",
  aftalt_mav: "sendes samlet",
  reservation: "trækkes løbende",
  klar: "på lager, intet aftalt",
  en_primeur: "forudbestilt, ikke ankommet",
};
function bucketFor(o: OpenOrderSummary): BucketKey {
  // §32h: first matching rule wins. Date before MAV — when a date is
  // set, the MAV flag is leftover, not a state. An order with both a
  // date and Levering=1 belongs in "med dato", not "med andre varer".
  if (o.isEnPrimeur) return "en_primeur";
  if (o.status === "restordre") return "afventer";
  if (o.status === "reservation") return "reservation";
  if (o.oensketLevering != null) return "aftalt_dato";
  if (o.isMav) return "aftalt_mav";
  return "klar";
}

export function AabneOrdrerSection({
  extension,
  companyId,
  companyName,
  layout = "mobile",
}: {
  extension: CompanyLagoExtension | null;
  companyId: number;
  companyName: string;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const query = useOpenOrders(extension?.visma_customer_no ?? null);
  const orders: OpenOrderSummary[] = query.data?.orders ?? [];
  // Brief 89 (28. sep 2026): hent kommentarer på kundens ordrer så vi
  // kan vise dem under hver række og undgå dobbelt-kommentar.
  const kommentarerQuery = useQuery({
    queryKey: ["lago-ordre-kommentarer", companyId],
    queryFn: () => fetchOrdreKommentarerForCompany(companyId),
    staleTime: 30_000,
  });
  const kommentarerPrOrdre = useMemo(() => {
    const map = new Map<string, OrdreKommentar[]>();
    for (const k of kommentarerQuery.data ?? []) {
      const cur = map.get(k.ordreNr);
      if (cur) cur.push(k);
      else map.set(k.ordreNr, [k]);
    }
    return map;
  }, [kommentarerQuery.data]);
  // §20d (30. sep 2026): orders start collapsed. Session-state per
  // customer so toggling survives navigation within a session.
  // sessionStorage key includes companyId so each customer remembers
  // independently. The old code initialized with an empty Set but the
  // comment said "rest-linjer starter åbne" — neither matched what the
  // user saw (all expanded). Now explicitly collapsed by default.
  const storageKey = `lago-ordre-expanded-${companyId}`;
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      /* ignore corrupt storage */
    }
    return new Set<string>();
  });
  const persistExpanded = (next: Set<string>) => {
    setExpanded(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* quota exceeded — ignore */
    }
  };
  const toggleExpanded = (ordreNr: string) => {
    const next = new Set(expanded);
    if (next.has(ordreNr)) next.delete(ordreNr);
    else next.add(ordreNr);
    persistExpanded(next);
  };
  const allExpanded =
    orders.length > 0 && orders.every((o) => expanded.has(o.ordre_nr));
  // Brief 89 (28. sep 2026): flervalg til "Kommentér valgte". Ét afkryds-
  // felt pr. ordre. Én kommentar → én række pr. ordre (så de kan lukkes
  // hver for sig). "Kommentér valgte"-knap er aktiv når mindst én er valgt.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (ordreNr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ordreNr)) next.delete(ordreNr);
      else next.add(ordreNr);
      return next;
    });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  // §38d: "Aftal levering" dialog for the klar bucket — pre-selects
  // hensigt "leveringsdato" and targets all klar orders.
  const [aftalDialogOpen, setAftalDialogOpen] = useState(false);

  const buckets = useMemo(() => {
    const map = new Map<BucketKey, OpenOrderSummary[]>();
    for (const o of orders) {
      const key = bucketFor(o);
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return map;
  }, [orders]);

  // §38b: groups are always open — no group folding state needed.
  // "Fold alle ud/ind" now only controls order-level expansion.
  const toggleAll = () => {
    if (allExpanded) {
      persistExpanded(new Set());
    } else {
      persistExpanded(new Set(orders.map((o) => o.ordre_nr)));
    }
  };

  // §29e: group selection — clicking a group toggles all orders in it.
  const toggleGroupSelection = (key: BucketKey) => {
    const groupOrders = buckets.get(key) ?? [];
    const groupNrs = groupOrders.map((o) => o.ordre_nr);
    const allSelected = groupNrs.every((nr) => selected.has(nr));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const nr of groupNrs) {
        if (allSelected) next.delete(nr);
        else next.add(nr);
      }
      return next;
    });
  };

  const totalBelob = orders.reduce((s, o) => s + o.total, 0);

  return (
    <Section variant={isLaptop ? "panel" : "divider"} id="aabne-ordrer">
      {/* §30a: count as Meta, amount in --fg with weight so it reads
          at a distance — same weight as the bucket sums below. */}
      {isLaptop ? (
        <SectionHeader
          variant="label"
          title="Åbne ordrer"
          subtitle={
            orders.length > 0 ? (
              <span>
                {orders.length} aktive ·{" "}
                <span className="font-semibold text-[var(--fg)] tabular-nums">
                  {kroner.format(totalBelob)}
                </span>
              </span>
            ) : undefined
          }
          right={
            orders.length > 1 ? (
              <button
                type="button"
                onClick={toggleAll}
                className="text-[length:var(--t-meta)] font-medium text-[var(--fg-2)] hover:text-[var(--fg)] underline-offset-2 hover:underline"
              >
                {allExpanded ? "Fold alle sammen" : "Fold alle ud"}
              </button>
            ) : undefined
          }
        />
      ) : (
        <SectionHeader
          title="Åbne ordrer"
          right={
            <span className="flex items-center gap-3">
              {orders.length > 0 && (
                <span className="flex items-baseline gap-1.5">
                  <Meta>{orders.length} aktive</Meta>
                  <span className="font-semibold text-[var(--fg)] text-sm tabular-nums">
                    {kroner.format(totalBelob)}
                  </span>
                </span>
              )}
              {orders.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[length:var(--t-meta)] font-medium text-[var(--fg-2)] hover:text-[var(--fg)] underline-offset-2 hover:underline"
                >
                  {allExpanded ? "Fold sammen" : "Fold ud"}
                </button>
              )}
            </span>
          }
        />
      )}
      {!extension?.visma_customer_no ? (
        <p className="text-sm text-[var(--fg-2)]">
          Ingen VISMA-kundenummer — ingen ordrer at slå op.
        </p>
      ) : query.isPending ? (
        <p className="text-sm text-[var(--fg-2)]">Henter ordrer …</p>
      ) : query.error ? (
        <p className="text-sm text-[var(--st-red-fg)]">
          Kunne ikke hente åbne ordrer.
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-[var(--fg-2)]">Ingen åbne ordrer.</p>
      ) : (
        <>
          {/* §29e: selection count + comment button. */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
              {selected.size > 0
                ? `${selected.size} valgt`
                : "Vælg en bunke eller enkelte ordrer for at kommentere"}
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={selected.size === 0}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium",
                selected.size > 0
                  ? "bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
                  : "bg-[var(--surface-2)] text-[var(--fg-3)]",
              )}
            >
              Kommentér valgte
            </button>
          </div>
          {/* §38b+c: buckets always open, with explanation in parens. */}
          {BUCKET_ORDER.map((bucketKey) => {
            const bucketOrders = buckets.get(bucketKey);
            if (!bucketOrders || bucketOrders.length === 0) return null;
            const bucketSum = bucketOrders.reduce((s, o) => s + o.total, 0);
            const groupAllSelected = bucketOrders.every((o) =>
              selected.has(o.ordre_nr),
            );
            return (
              <div
                key={bucketKey}
                className="border-b border-[var(--line)] last:border-b-0"
              >
                {/* §38c: bucket header with hint + count + amount */}
                <div className="flex items-center gap-2 py-3">
                  <input
                    type="checkbox"
                    checked={groupAllSelected}
                    onChange={() => toggleGroupSelection(bucketKey)}
                    aria-label={`Vælg alle i ${BUCKET_LABEL[bucketKey]}`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                  />
                  <span className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-sm text-[var(--fg)]">
                      {BUCKET_LABEL[bucketKey]}
                    </span>
                    <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      ({BUCKET_HINT[bucketKey]})
                    </span>
                  </span>
                  <span className="shrink-0 text-[length:var(--t-meta)] text-[var(--fg-3)] whitespace-nowrap">
                    {bucketOrders.length}{" "}
                    {bucketOrders.length === 1 ? "ordre" : "ordrer"}
                  </span>
                  <span className="shrink-0 font-semibold text-sm tabular-nums text-[var(--fg)]">
                    {kroner.format(bucketSum)}
                  </span>
                </div>
                {/* §38b: orders always visible — no group folding. */}
                <div className="pl-6 pb-2">
                  <RowGroup>
                    {bucketOrders.map((o) => (
                      <OrderRow
                        key={o.ordre_nr}
                        order={o}
                        open={expanded.has(o.ordre_nr)}
                        onToggle={() => toggleExpanded(o.ordre_nr)}
                        selected={selected.has(o.ordre_nr)}
                        onToggleSelect={() => toggleSelected(o.ordre_nr)}
                        kommentarer={kommentarerPrOrdre.get(o.ordre_nr) ?? []}
                      />
                    ))}
                  </RowGroup>
                  {/* §38d: "Aftal levering" button — only on the klar bucket.
                      Opens the existing comment dialog with hensigt pre-set
                      to "leveringsdato". Full width on mobile (§38e). */}
                  {bucketKey === "klar" && (
                    <div className="mt-2">
                      <LagoButton
                        variant="secondary"
                        onClick={() => setAftalDialogOpen(true)}
                        className="w-full md:w-auto"
                      >
                        Aftal levering
                      </LagoButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
      <OrdreKommentarDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setSelected(new Set());
        }}
        companyId={companyId}
        companyName={companyName}
        ordreNumre={Array.from(selected)}
      />
      {/* §38d: "Aftal levering" dialog for klar bucket — pre-selects
          leveringsdato hensigt and targets all klar orders. */}
      <OrdreKommentarDialog
        open={aftalDialogOpen}
        onOpenChange={setAftalDialogOpen}
        companyId={companyId}
        companyName={companyName}
        ordreNumre={(buckets.get("klar") ?? []).map((o) => o.ordre_nr)}
        defaultHensigt="leveringsdato"
      />
    </Section>
  );
}

/**
 * Brief 75 tillæg F (22. sep 2026) · to-linjers ordre-blok.
 *
 * Tabelrækken fra tillæg D brækkede på 390 px (ordrenr over to linjer,
 * dato over tre). Mobilreglen fra brief 50: ikke en tabelrække, en
 * lille blok. Hierarki:
 *   Linje 1: ▸ Ordre #34696                    [Restordre]
 *   Linje 2: 8. sep · 3 linjer afventer          5.610 kr.
 * Ordre-nr står som en reference (fg-3, t-meta) — det er det, sælgeren
 * bruger sidst. Statuschippen og beløbet er højrestillet.
 */
function OrderRow({
  order: o,
  open,
  onToggle,
  selected,
  onToggleSelect,
  kommentarer,
}: {
  order: OpenOrderSummary;
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  kommentarer: OrdreKommentar[];
}) {
  const hasLines = o.lines.length > 0;
  // §38a: one-line compact row. Middle column = why it's here.
  // Only fields we have — never computed text.
  const midParts: string[] = [];
  if (o.status === "reservation") {
    midParts.push(`${o.reservationAntal} stk. på reservation`);
  } else if (o.restLineCount > 0) {
    midParts.push(
      `${o.restLineCount} ${o.restLineCount === 1 ? "linje" : "linjer"} afventer`,
    );
  }
  if (o.note) midParts.push(o.note);
  if (o.oensketLevering) {
    const dateLabel = isPastDate(o.oensketLevering)
      ? `Ønsket levering ${formatWeekdayDate(o.oensketLevering)} ⚠`
      : `Ønsket levering ${formatWeekdayDate(o.oensketLevering)}`;
    midParts.push(dateLabel);
  }
  const midText = midParts.join(" · ");
  const toggleLabel = open ? "Skjul detaljer" : "Se detaljer";

  return (
    <li className="flex flex-col">
      {/* §38a: compact one-line row. Desktop: three columns.
          Mobile (<768px): two lines. */}
      <div className="flex items-center gap-2 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Vælg ordre ${o.ordre_nr} til kommentar`}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--ink)]"
        />
        {/* Clickable area — whole row toggles details */}
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasLines}
          className="flex flex-1 items-baseline gap-3 text-left min-w-0"
        >
          {/* Left: fixed width — order nr + date */}
          <span className="shrink-0 text-[length:var(--t-meta)] text-[var(--fg-3)] whitespace-nowrap hidden md:inline">
            Ordre #{o.ordre_nr} · {dateShort(o.ordre_dato)}
          </span>
          {/* Mobile: order nr + amount on first line */}
          <span className="md:hidden flex flex-1 items-baseline justify-between gap-2">
            <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
              #{o.ordre_nr} · {dateShort(o.ordre_dato)}
            </span>
            <span className="shrink-0 text-sm font-medium text-[var(--fg)] tabular-nums">
              {kroner.format(o.total)}
            </span>
          </span>
          {/* Middle: why it's here — desktop only on same line */}
          {midText && (
            <span
              className={cn(
                "min-w-0 truncate text-[length:var(--t-sec)]",
                o.oensketLevering && isPastDate(o.oensketLevering)
                  ? "text-[var(--st-red-fg)]"
                  : "text-[var(--fg-2)]",
                "hidden md:inline",
              )}
            >
              {midText}
            </span>
          )}
          {/* Spacer */}
          <span className="hidden md:inline flex-1" />
          {/* Right: amount — desktop */}
          <span className="hidden md:inline shrink-0 text-sm font-medium text-[var(--fg)] tabular-nums">
            {kroner.format(o.total)}
          </span>
        </button>
        {/* §38f: "Se detaljer" replaces chevron */}
        {hasLines && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 text-[length:var(--t-meta)] font-medium text-[var(--fg-2)] hover:text-[var(--fg)] whitespace-nowrap underline-offset-2 hover:underline"
          >
            {toggleLabel}
          </button>
        )}
      </div>
      {/* Mobile middle line */}
      {midText && (
        <p
          className={cn(
            "md:hidden pl-6 pb-1 truncate text-[length:var(--t-sec)]",
            o.oensketLevering && isPastDate(o.oensketLevering)
              ? "text-[var(--st-red-fg)]"
              : "text-[var(--fg-2)]",
          )}
        >
          {midText}
        </p>
      )}
      {/* Kommentarer */}
      {kommentarer.map((k) => (
        <div
          key={k.id}
          className="ml-6 rounded-md border-l-2 border-[var(--st-green)] bg-[var(--surface-1)] px-3 py-2 text-[length:var(--t-sec)]"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-[var(--fg)]">
              {HENSIGT_LABEL[k.hensigt]}
            </span>
            {k.aftaltDato && (
              <span className="text-[var(--fg-2)]">
                · {formatWeekdayDate(k.aftaltDato)}
              </span>
            )}
          </div>
          {k.note && (
            <div className="mt-0.5">
              <ExpandableNote
                text={k.note}
                clampLines={4}
                className="text-[var(--fg-2)]"
              />
            </div>
          )}
          <p className="mt-0.5 text-[12px] text-[var(--fg-3)]">
            {k.oprettetAfNavn ?? "(ukendt)"} · {dateShort(k.oprettet)}
          </p>
        </div>
      ))}
      {/* Notes above lines */}
      {open && o.orderNotes.length > 0 && (
        <div className="mt-1 pl-6">
          <ExpandableNote
            text={o.orderNotes.map((n) => n.beskrivelse).join("\n")}
            clampLines={3}
            className="text-[length:var(--t-meta)] text-[var(--fg-2)]"
          />
        </div>
      )}
      {open && hasLines && (
        <OrderLines lines={o.lines} tillaegOgAfgifter={o.tillaegOgAfgifter} />
      )}
    </li>
  );
}

/**
 * Brief 75 tillæg E (22. sep 2026): grænse på ordre-listen. Fem er
 * højt nok til at dække medianen af kunder, lavt nok til at kundekortet
 * ikke svulmer på storkunder med 12+ åbne ordrer. Når grænsen skjuler
 * ordrer, står "Vis alle N ordrer →" under listen — så tallet stemmer
 * med overskriften og totalen.
 */
// §29: ORDER_LIMIT removed — grouping replaces flat-list clipping.

/**
 * Brief 75 tillæg D §4: linje-detaljer i en foldet-ud ordre.
 * Grænsen fra tillæg A §4: højst 10 linjer, så "Vis alle N →".
 * Median er 9, så de fleste ordrer folder helt ud.
 */
const ORDER_LINE_LIMIT = 10;

function OrderLines({
  lines,
  tillaegOgAfgifter,
}: {
  lines: OpenOrderLine[];
  tillaegOgAfgifter: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleLines = showAll ? lines : lines.slice(0, ORDER_LINE_LIMIT);
  const hidden = lines.length - visibleLines.length;
  // §20 (29. sep 2026): sumrækken — tallene ingen kan regne i hovedet.
  // Klar / Afventer / I alt. Reservation slås sammen med afventer
  // (kunden venter stadig). Beløb regnes på synlige linjer, inklusive
  // "Vis alle" — vi viser tallene for den fulde ordre uanset klipning.
  const klarSum = lines
    .filter((l) => l.kundeStatus === "klar")
    .reduce((s, l) => s + l.ej_faktureret, 0);
  const afventerSum = lines
    .filter((l) => l.kundeStatus !== "klar")
    .reduce((s, l) => s + l.ej_faktureret, 0);
  const iAltSum = klarSum + afventerSum + Math.max(0, tillaegOgAfgifter);
  // Index for den første klar-linje så vi kan lægge en skillelinje der.
  // Kilden er sorteret: reservation → afventer → delvis → klar. Første
  // "klar" markerer grænsen mellem afventende og afsendte varer.
  const firstKlarIdx = visibleLines.findIndex((l) => l.kundeStatus === "klar");
  return (
    <div className="@container mt-1">
      {/* §20b-a (30. sep 2026): no grey box — lines sit directly on
          --surface, separated by hairline --line borders. */}
      {/* §20b-f: Vare gets remaining space (w-full), Antal/Beløb/Status
          shrink to content (w-auto whitespace-nowrap). Names wrap instead
          of truncating — a truncated product name is useless. */}
      <table className="hidden w-full text-sm @[640px]:table">
        <colgroup>
          <col className="w-full" />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="text-left text-[length:var(--t-meta)] font-medium text-[var(--fg-3)]">
            <th className="pb-2 pr-3 font-medium">Vare</th>
            <th className="whitespace-nowrap pb-2 pr-3 text-right font-medium">
              Antal
            </th>
            <th className="whitespace-nowrap pb-2 pr-3 text-right font-medium">
              Beløb
            </th>
            <th className="whitespace-nowrap pb-2 text-right font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleLines.map((l, i) => {
            const showDivider = i === firstKlarIdx && i > 0;
            return (
              <OrderLineTableRow
                key={l.linje_nr}
                line={l}
                showDivider={showDivider}
              />
            );
          })}
          {/* §20b-b/c: hairline border, aligned to columns. Klar/Afventer
              as Meta in the Vare column; total under Beløb column. */}
          <tr className="border-t border-[var(--line)]">
            <td className="pt-2 text-[length:var(--t-meta)] text-[var(--fg-2)]">
              Klar {kroner.format(klarSum)} · Afventer{" "}
              {kroner.format(afventerSum)}
              {tillaegOgAfgifter > 0
                ? ` · Tillæg ${kroner.format(tillaegOgAfgifter)}`
                : ""}
            </td>
            <td className="pt-2" />
            <td className="pt-2 text-right font-medium tabular-nums text-[var(--fg)]">
              {kroner.format(iAltSum)}
            </td>
            <td className="pt-2" />
          </tr>
          {hidden > 0 && (
            <tr>
              <td colSpan={4} className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-[length:var(--t-sec)] font-medium text-[var(--fg-2)] underline-offset-2 hover:underline"
                >
                  Vis alle {lines.length} →
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* <1280 px: panelform. TableRow-mønstret siger tabellen er
          kontorets; sælgeren står i en butik med telefonen. Beholder
          den eksisterende to-linjers OrderLineRow. */}
      <ul className="flex flex-col gap-2 @[640px]:hidden">
        {visibleLines.map((l, i) => {
          const showDivider = i === firstKlarIdx && i > 0;
          return (
            <OrderLineRow key={l.linje_nr} line={l} showDivider={showDivider} />
          );
        })}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[length:var(--t-sec)] text-[var(--fg-2)] font-medium underline-offset-2 hover:underline"
            >
              Vis alle {lines.length} →
            </button>
          </li>
        )}
        {tillaegOgAfgifter > 0 && (
          <li className="mt-1 flex items-baseline justify-between border-t border-[var(--line-2)] pt-2 text-[length:var(--t-meta)] text-[var(--fg-2)]">
            <span>Tillæg og afgifter</span>
            <span className="tabular-nums">
              {kroner.format(tillaegOgAfgifter)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * §20 (29. sep 2026): tabel-versionen af ordrelinjen. Fire kolonner,
 * højre-justerede tal, status som Meta ikke Badge. Skillelinje ved
 * første klar-linje så afventende står øverst i deres egen blok.
 */
function OrderLineTableRow({
  line: l,
  showDivider,
}: {
  line: OpenOrderLine;
  showDivider: boolean;
}) {
  const isDelvis = l.kundeStatus === "delvis";
  const statusTekst =
    l.kundeStatus === "reservation"
      ? "på reservation"
      : l.kundeStatus === "klar"
        ? "klar"
        : l.kundeStatus === "afventer"
          ? "afventer ankomst"
          : `${l.reserveret} klar, ${l.rest} mangler`;
  return (
    <tr className={showDivider ? "border-t border-[var(--line)]" : ""}>
      {/* §20b-f: break-words instead of truncate — an ellipsised product
          name is useless for a salesperson standing with the customer. */}
      <td className="py-1.5 pr-3 text-[var(--fg)] break-words">
        {l.produktnavn}
        {l.belobLabel && (
          <span className="text-[var(--fg-3)]"> · {l.belobLabel}</span>
        )}
      </td>
      {/* §20b-d: tabular-nums + whitespace-nowrap on both columns. */}
      <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-[var(--fg)]">
        {l.antal || ""}
      </td>
      <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-[var(--fg)]">
        {kroner.format(l.ej_faktureret)}
      </td>
      <td
        className={cn(
          "py-1.5 text-right text-[length:var(--t-meta)]",
          isDelvis
            ? "font-medium text-[var(--st-red-fg)]"
            : "text-[var(--fg-2)]",
        )}
      >
        {statusTekst}
      </td>
    </tr>
  );
}

/**
 * Brief 75 tillæg F (22. sep 2026) · to-linjers ordrelinje-blok.
 *
 *   Vista Alegre Fine Ruby · kampagne
 *   60 stk. · 0 kr. · afventer ankomst
 *
 * Linje 1: produktnavnet i fuld bredde (fg, normal vægt), ombrudt fremfor
 * afkortet. Prisstruktur-labelen ("kampagne", "prøve", …) hænger EFTER
 * navnet som en dæmpet tilføjelse — så "0 kr." forbliver et beløb.
 * Linje 2: antal · beløb · statustekst, adskilt med `·`, alt i fg-2/t-sec.
 * Statustekst kommer fra rest (kundens mangel), ikke lagerstatus.
 */
function OrderLineRow({
  line: l,
  showDivider,
}: {
  line: OpenOrderLine;
  showDivider?: boolean;
}) {
  // Brief 78 tillæg A §1 · rev. brief 75 tillæg G (22. sep 2026):
  //   - reservation (levering=5): "på reservation"
  //   - klar (reserveret ≥ antal): "klar"
  //   - delvis (0 < reserveret < antal): "N klar, M mangler" i rødt
  //   - afventer (reserveret = 0): "afventer ankomst"
  const isDelvis = l.kundeStatus === "delvis";
  const statusTekst =
    l.kundeStatus === "reservation"
      ? "på reservation"
      : l.kundeStatus === "klar"
        ? "klar"
        : l.kundeStatus === "afventer"
          ? "afventer ankomst"
          : `${l.reserveret} klar, ${l.rest} mangler`;
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5",
        showDivider && "border-t border-[var(--line-2)] pt-2",
      )}
    >
      <span className="text-[length:var(--t-sec)] text-[var(--fg)] break-words">
        {l.produktnavn}
        {l.belobLabel && (
          <span className="text-[var(--fg-3)]"> · {l.belobLabel}</span>
        )}
      </span>
      <span className="text-[length:var(--t-meta)] text-[var(--fg-2)]">
        {l.antal ? (
          <span className="tabular-nums">{l.antal} stk. · </span>
        ) : null}
        <span className="tabular-nums">{kroner.format(l.ej_faktureret)}</span>
        <span> · </span>
        <span
          className={cn(
            "tabular-nums",
            isDelvis && "text-[var(--st-red-fg)] font-medium",
          )}
        >
          {statusTekst}
        </span>
      </span>
    </li>
  );
}

// §29c: OrderTotals removed — group header rows ARE the sums now.
// The card footer duplicated totals that were already visible as
// bucket headers. Header shows "14 aktive · 299.043 kr.".

/** Brief 51 §4: "fredag 17. maj" — dansk ugedag + dag + kort måned. */
function formatWeekdayDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(d);
}

function isPastDate(iso: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}

// ------------------------------------------------------------------
// 8. Stamdata
// ------------------------------------------------------------------

export function StamdataSection({
  data,
  layout = "mobile",
}: {
  data: LagoCustomerData;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const [detaljerOpen, setDetaljerOpen] = useState(false);
  const [frekvensOpen, setFrekvensOpen] = useState(false);
  const [saesonlukketOpen, setSaesonlukketOpen] = useState(false);
  const [ringelisteLukOpen, setRingelisteLukOpen] = useState(false);
  const sellers = useSellerLookup();
  const intervals = useVisitIntervals();
  const { role, salesId: mySalesId } = useCurrentLagoRole();
  const { company, extension } = data;
  // Brief 65 §5: sælger må redigere sin egen kunde, admin/kontor må
  // altid. Ledelse må ikke — de læser, de retter ikke.
  const canEditFrekvens =
    role === "admin" ||
    role === "kontor" ||
    (role === "saelger" && mySalesId != null && company.sales_id === mySalesId);
  const salesName =
    sellers.byCode(extension?.visma_sales_code) ??
    extension?.visma_sales_name ??
    null;
  // Brief 50 §2 (17. sep 2026): "Adelgade 46 · 5400 Bogense" —
  // postnummer og by er ét led, · som separator. Samme form som i
  // preview og mobil-header.
  const zipCity = [company.zipcode, company.city].filter(Boolean).join(" ");
  const address = [company.address, zipCity].filter(Boolean).join(" · ");
  // Brief 65 tillæg A §1 (18. sep 2026): segment-rækken siger kun
  // bogstavet + evt. hvad det betyder (X=uklassificeret, L=lead).
  // Intervallet staar KUN ét sted paa kortet — i Besoegsfrekvens-linjen
  // — for at undgaa modstridende tal (30 vs 75) naar en override er sat.
  const segmentLabel = extension?.segment
    ? formatSegmentLabel(extension.segment)
    : "—";
  // Brief 45 §5 (16. sep 2026): kerne-infos INDHOLD bevares — VISMA-
  // sætning i toppen, "Mangler:"-linje i bunden. Kun PLACERINGEN
  // ændres (fra top-af-InfoRail til bund-af-kort). Rækkerne herunder
  // er samme rækker som brief 37 §2 førte i CoreInfoCard.
  const mangler = collectMangler(data);
  // Brief 58 §1 (17. sep 2026): blokken deles i to efter ejerskab.
  // INFORMATION øverst — CRM-ejede felter (Åbningstider, Noter) med
  // "Redigér"-knap der åbner DetaljerDialog. STAMDATA nederst — VISMA-
  // ejede felter med "fra VISMA" som Meta i headeren og blyanter pr.
  // række (ProposeChangeButton). Segment forbliver i STAMDATA uden
  // blyant, indtil ROADMAP 2a-2 afgør hvordan det ændres.
  //
  // Forvirringen før var: "Redigér detaljer" sad i STAMDATA-blokken,
  // men redigerede felter i INFORMATION. Blyantens betydning skifter
  // mellem de to blokke — i STAMDATA foreslår man, i INFORMATION retter
  // man direkte. "fra VISMA" er den billigste måde at sige forskellen.
  const editButton = (
    <LagoButton
      variant="secondary"
      icon={Pencil}
      onClick={() => setDetaljerOpen(true)}
    >
      Redigér
    </LagoButton>
  );
  return (
    <>
      {/* INFORMATION — CRM-ejet, redigeres direkte. */}
      <Section variant={isLaptop ? "panel" : "divider"}>
        {isLaptop ? (
          <SectionHeader
            variant="label"
            title="Information"
            action={editButton}
          />
        ) : (
          <SectionHeader title="Information" />
        )}
        <dl className="flex flex-col text-sm">
          <StamRow
            label="Åbningstider"
            value={extension?.opening_hours ?? null}
          />
          <StamRow label="Noter" value={company.description ?? null} />
          <BesoegsfrekvensRow
            extension={extension}
            visitPriority={data.visitPriority}
            sellerName={sellers.bySalesId(
              extension?.besoegsfrekvens_sat_af ?? null,
            )}
            canEdit={canEditFrekvens}
            onEdit={() => setFrekvensOpen(true)}
          />
          <SaesonlukketRow
            extension={extension}
            canEdit={canEditFrekvens}
            onEdit={() => setSaesonlukketOpen(true)}
          />
          <RingelisteLukRow
            visitPriority={data.visitPriority}
            extension={extension}
            canEdit={canEditFrekvens}
            onEdit={() => setRingelisteLukOpen(true)}
          />
        </dl>
        {!isLaptop && <div className="mt-3">{editButton}</div>}
      </Section>

      {/* STAMDATA — VISMA-ejet, blyant = foreslå ændring. */}
      <Section isLast variant={isLaptop ? "panel" : "divider"}>
        <SectionHeader
          variant={isLaptop ? "label" : "regular"}
          title="Stamdata"
          right={<Meta>fra VISMA</Meta>}
        />
        <dl className="flex flex-col text-sm">
          <StamRow
            label="Adresse"
            value={address || null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="address"
            proposeSource="companies"
          />
          <StamRow
            label="Telefon"
            value={
              company.phone_number ? (
                // Brief 51 §2 (17. sep 2026): nummer i par.
                <a
                  href={`tel:${company.phone_number}`}
                  className="text-[var(--ink)] underline-offset-2 hover:underline"
                >
                  {formatPhonePairs(company.phone_number)}
                </a>
              ) : null
            }
            rawValue={company.phone_number ?? null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="phone_number"
            proposeSource="companies"
          />
          <StamRow
            label="Faktura-e-mail"
            value={
              extension?.faktura_email ? (
                <a
                  href={`mailto:${extension.faktura_email}`}
                  title={extension.faktura_email}
                  className="block truncate text-[var(--ink)] underline-offset-2 hover:underline"
                >
                  {extension.faktura_email}
                </a>
              ) : null
            }
            rawValue={extension?.faktura_email ?? null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="faktura_email"
            proposeSource="companies_lago"
          />
          <StamRow
            label="CVR-nummer"
            value={company.tax_identifier ?? null}
            rawValue={company.tax_identifier ?? null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="tax_identifier"
            proposeSource="companies"
          />
          <StamRow label="Branche" value={company.sector ?? null} />
          <StamRow
            label="Distrikt"
            value={extension?.distrikt ?? null}
            rawValue={extension?.distrikt ?? null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="distrikt"
            proposeSource="companies_lago"
          />
          <StamRow
            label="Ansvarlig sælger"
            value={salesName}
            rawValue={salesName}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="visma_sales_code"
            proposeSource="companies_lago"
          />
          <StamRow label="Segment" value={segmentLabel} />
          <StamRow
            label="Betalingsbetingelser"
            value={extension?.betaling ?? null}
            rawValue={extension?.betaling ?? null}
            companyId={company.id}
            companyName={company.name}
            proposeFelt="betaling"
            proposeSource="companies_lago"
          />
          {extension?.debitorinfo && (
            <StamRow label="Debitorinfo" value={extension.debitorinfo} />
          )}
        </dl>
        {mangler.length > 0 && (
          <p className="mt-3 border-t border-[var(--line)] pt-3 text-[length:var(--t-sec)] text-[var(--fg-2)]">
            Mangler:{" "}
            <span className="text-[var(--fg)]">{mangler.join(", ")}</span>
          </p>
        )}
      </Section>

      <DetaljerDialog
        open={detaljerOpen}
        onOpenChange={setDetaljerOpen}
        companyId={company.id}
        initial={{
          sector: company.sector ?? null,
          opening_hours: extension?.opening_hours ?? null,
          description: company.description ?? null,
        }}
      />

      {canEditFrekvens && mySalesId != null && (
        <BesoegsfrekvensDialog
          open={frekvensOpen}
          onOpenChange={setFrekvensOpen}
          companyId={company.id}
          companyName={company.name}
          segment={extension?.segment ?? null}
          defaultIntervalDays={defaultIntervalForSegment(
            extension?.segment ?? null,
            intervals,
          )}
          initial={{
            besoegsfrekvens_dage: extension?.besoegsfrekvens_dage ?? null,
            besoegsfrekvens_note: extension?.besoegsfrekvens_note ?? null,
          }}
          currentSalesId={mySalesId}
        />
      )}

      {canEditFrekvens && (
        <SaesonlukketDialog
          open={saesonlukketOpen}
          onOpenChange={setSaesonlukketOpen}
          companyId={company.id}
          companyName={company.name}
          initial={{
            saesonlukket_fra: extension?.saesonlukket_fra ?? null,
            saesonlukket_til: extension?.saesonlukket_til ?? null,
          }}
        />
      )}

      {canEditFrekvens && (
        <RingelisteLukDialog
          open={ringelisteLukOpen}
          onOpenChange={setRingelisteLukOpen}
          companyId={company.id}
          companyName={company.name}
          lastVisitAtVedLukning={extension?.last_visit_at ?? null}
          daysOverdueVedLukning={data.visitPriority?.days_overdue ?? null}
        />
      )}
    </>
  );
}

/**
 * Brief 65: kun bruges til at fylde dialogens "Segmentets standard"-linje.
 * Selve beregningen af effektivt interval sker i view'et. Her handler det
 * om at vise: "hvis du vælger standarden, får du dette tal".
 */
function defaultIntervalForSegment(
  seg: "A" | "B" | "C" | "X" | "L" | null,
  cfg: { intervalDays: Record<"A" | "B" | "C", number> },
): number | null {
  if (seg === "A" || seg === "B" || seg === "C") return cfg.intervalDays[seg];
  // X/L har ingen kadence som standard — dialogen viser "ingen kadence".
  return null;
}

/**
 * Brief 65 §3: "hver N. dag · valgt af X, dato" ELLER
 * "hver N. dag · systemstandard (segment B)". Ordet "systemstandard"
 * skal stå der — ellers ved man ikke, om tallet er en beslutning.
 * Noten står under, dæmpet, hvis der er en. Blyanten er en almindelig
 * redigering, ikke et forslag (feltet er CRM-ejet).
 */
function BesoegsfrekvensRow({
  extension,
  visitPriority,
  sellerName,
  canEdit,
  onEdit,
}: {
  extension: LagoCustomerData["extension"];
  visitPriority: LagoCustomerData["visitPriority"];
  sellerName: string | null;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const override = extension?.besoegsfrekvens_dage ?? null;
  const intervalDays = visitPriority?.interval_days ?? null;
  const seg = extension?.segment ?? null;
  const note = extension?.besoegsfrekvens_note ?? null;
  const setAt = extension?.besoegsfrekvens_sat ?? null;

  let mainText: string;
  let subText: string;
  if (override != null) {
    // Override sat. Navn + dato hvis vi har dem.
    const who = sellerName ?? "ukendt";
    const when = formatShortDate(setAt);
    mainText = `hver ${override}. dag`;
    subText = when ? `valgt af ${who}, ${when}` : `valgt af ${who}`;
  } else if (intervalDays != null) {
    // Systemstandard fra segmentet.
    mainText = `hver ${intervalDays}. dag`;
    subText = `systemstandard${seg ? ` (segment ${seg})` : ""}`;
  } else {
    // X/L uden override — ingen kadence.
    mainText = "ingen kadence";
    subText = `systemstandard${seg ? ` (segment ${seg})` : ""}`;
  }

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--line)] py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
          Besøgsfrekvens
        </dt>
        <dd className="flex items-baseline gap-2 text-right">
          <span className="text-sm text-[var(--fg)]">{mainText}</span>
          <span className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
            · {subText}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Redigér besøgsfrekvens"
              className="ml-1 rounded p-1 text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]"
            >
              <Icon icon={Pencil} className="h-3.5 w-3.5" />
            </button>
          )}
        </dd>
      </div>
      {note && (
        <p className="text-right text-[length:var(--t-sec)] text-[var(--fg-2)]">
          »{note}«
        </p>
      )}
    </div>
  );
}

/**
 * Brief 90 §3 (28. sep 2026): sæsonlukket-periode-rækken. Én linje der
 * viser om kunden er i vinduet nu ("Sæsonlukket til 1. marts"), venter
 * på et fremtidigt vindue ("Sæsonlukket fra … til …"), eller ikke er
 * sat op. Blyanten åbner SaesonlukketDialog. Uret røres ikke — det er
 * dialogens ansvar at holde last_visit_at urørt.
 */
function SaesonlukketRow({
  extension,
  canEdit,
  onEdit,
}: {
  extension: LagoCustomerData["extension"];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const fra = extension?.saesonlukket_fra ?? null;
  const til = extension?.saesonlukket_til ?? null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isSet = !!fra && !!til;
  const fraDate = fra ? new Date(fra) : null;
  const tilDate = til ? new Date(til) : null;
  const inWindow = isSet && fraDate! <= today && today <= tilDate!;
  const future = isSet && fraDate! > today;
  const past = isSet && tilDate! < today;

  let mainText: string;
  let subText: string | null;
  if (!isSet) {
    mainText = "Ikke sat";
    subText = null;
  } else if (inWindow) {
    mainText = `Sæsonlukket til ${formatShortDate(til)}`;
    subText = "Åbner sig automatisk";
  } else if (future) {
    mainText = `Sæsonlukker ${formatShortDate(fra)}`;
    subText = `Til ${formatShortDate(til)}`;
  } else if (past) {
    // Historisk periode — ligger stadig i databasen men gør intet
    // (view'et ser CURRENT_DATE > til). Vises som "sidste periode:"
    // så den kan ryddes hvis nogen synes den støjer.
    mainText = "Ikke sat";
    subText = `Sidste periode: ${formatShortDate(fra)} – ${formatShortDate(til)}`;
  } else {
    mainText = "Ikke sat";
    subText = null;
  }

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--line)] py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
          Sæsonlukket
        </dt>
        <dd className="flex items-baseline gap-2 text-right">
          <span
            className={
              inWindow
                ? "text-sm font-medium text-[var(--fg)]"
                : "text-sm text-[var(--fg)]"
            }
          >
            {mainText}
          </span>
          {subText && (
            <span className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
              · {subText}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Redigér sæsonlukket-periode"
              className="ml-1 rounded p-1 text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]"
            >
              <Icon icon={Pencil} className="h-3.5 w-3.5" />
            </button>
          )}
        </dd>
      </div>
    </div>
  );
}

/**
 * Brief 90 §2 (28. sep 2026): "Luk fra ringelisten"-rækken. Vises kun
 * for kunder der ER på ringelisten lige nu — dvs. overdue eller
 * never_visited, days_overdue ≥ 14, next_visit_planned mangler.
 * Kontoret må ringe; ejerskabet bliver hos sælgeren. Uden ringeliste-
 * kvalifikation vises rækken slet ikke — for at spare kortet for støj.
 */
function RingelisteLukRow({
  visitPriority,
  extension,
  canEdit,
  onEdit,
}: {
  visitPriority: LagoCustomerData["visitPriority"];
  extension: LagoCustomerData["extension"];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const status = visitPriority?.status ?? null;
  const daysOverdue = visitPriority?.days_overdue ?? 0;
  const nextVisitPlanned = extension?.next_visit_planned ?? null;
  // Rammer ringelistens filter?
  const onList =
    !nextVisitPlanned &&
    (status === "never_visited" || (status === "overdue" && daysOverdue >= 14));
  if (!onList) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--line)] py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
          Ringelisten
        </dt>
        <dd className="flex items-baseline gap-2 text-right">
          <span className="text-sm text-[var(--fg)]">
            {status === "never_visited"
              ? "Aldrig besøgt"
              : `${daysOverdue} dage over`}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="ml-1 rounded px-2 py-0.5 text-[length:var(--t-sec)] font-medium text-[var(--fg-2)] underline-offset-2 hover:bg-[var(--bg-2)] hover:text-[var(--fg)] hover:underline"
            >
              Luk fra listen
            </button>
          )}
        </dd>
      </div>
    </div>
  );
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

const MANGLER_ORDER: readonly {
  label: string;
  present: (data: LagoCustomerData) => boolean;
}[] = [
  { label: "Adresse", present: (d) => Boolean(d.company.address) },
  { label: "Telefon", present: (d) => Boolean(d.company.phone_number) },
  {
    label: "Faktura-e-mail",
    present: (d) => Boolean(d.extension?.faktura_email),
  },
  { label: "CVR", present: (d) => Boolean(d.company.tax_identifier) },
  { label: "Distrikt", present: (d) => Boolean(d.extension?.distrikt) },
  { label: "Betaling", present: (d) => Boolean(d.extension?.betaling) },
];

function collectMangler(data: LagoCustomerData): string[] {
  return MANGLER_ORDER.filter((f) => !f.present(data)).map((f) => f.label);
}

function StamRow({
  label,
  value,
  rawValue,
  companyId,
  companyName,
  proposeFelt,
  proposeSource,
}: {
  label: string;
  value: React.ReactNode | null;
  rawValue?: string | null;
  companyId?: number;
  companyName?: string;
  proposeFelt?: string;
  proposeSource?: "companies" | "companies_lago";
}) {
  const canPropose =
    proposeFelt && proposeSource && companyId != null && companyName != null;
  // Brief 50 §5 (17. sep 2026): hver StamRow er selv-indeholdende med
  // egen border-b — divide-y-varianten gav uens hairlines når nogle
  // rækker var conditional-rendered og forsvandt fra søskende-listen.
  return (
    <div className="group flex items-start justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0">
      <dt className="shrink-0 text-[var(--fg-2)]">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-[var(--fg)]">
        <span className="inline-flex items-baseline gap-1">
          {value ?? <span className="text-[var(--fg-3)]">—</span>}
          {canPropose && (
            <ProposeChangeButton
              companyId={companyId}
              companyName={companyName}
              felt={proposeFelt}
              feltSource={proposeSource}
              feltLabel={label}
              nuvaerendeVaerdi={rawValue ?? null}
            />
          )}
        </span>
      </dd>
    </div>
  );
}

function formatSegmentLabel(s: "A" | "B" | "C" | "X" | "L"): string {
  if (s === "X") return "X · Uklassificeret";
  if (s === "L") return "L · Lead";
  return s;
}
