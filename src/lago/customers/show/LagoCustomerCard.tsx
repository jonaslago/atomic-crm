import { useMemo, useState } from "react";
import { useGetIdentity, useTranslate } from "ra-core";
import { Link } from "react-router-dom";
import { MapPin, Pencil, Phone, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";

import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { useSoftDeleteActivity } from "@/lago/registrer/mutations";
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
import { BesoegsfrekvensDialog } from "./BesoegsfrekvensDialog";
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import { ProposeChangeButton } from "./ProposeChangeDialog";
import {
  useOpenOrders,
  type OpenOrderSummary,
  type OpenOrdersTotals,
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
      <AabneOrdrerSection extension={data.extension} />
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
}: {
  children: React.ReactNode;
  isLast?: boolean;
  variant?: SectionVariant;
  className?: string;
}) {
  if (variant === "panel") {
    return (
      <section
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
        raw: a,
      }));
    // Noter, der er skrevet på kunden (uden en tilknyttet task), er
    // også en del af historikken.
    const noteRows = data.notes.map((n) => ({
      id: `note-${n.id}`,
      kind: "Note" as string,
      salesName: null,
      date: n.created_at,
      detail: n.text,
      raw: null,
    }));
    return [...activityRows, ...noteRows].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }, [data.activities, data.notes, taskTypes]);

  const canEditActivity = (raw: (typeof rows)[number]["raw"]) => {
    if (!raw) return false;
    return (
      raw.source === "crm_native" &&
      (isAdmin || (currentSalesId != null && raw.sales_id === currentSalesId))
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
          subtitle={rows.length > 0 ? `${rows.length} aktiviteter` : undefined}
        />
      ) : (
        <SectionHeader
          title="Hvad skete der sidst"
          right={rows.length > 0 && <Meta>{rows.length} aktiviteter</Meta>}
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
            if (r.raw && canEditActivity(r.raw)) {
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
                onSelect: () =>
                  softDelete.mutate({
                    activityId: r.raw!.id,
                    companyId: data.company.id,
                    companyName: data.company.name,
                  }),
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
                  <p className="text-sm text-[var(--fg-2)] whitespace-pre-wrap">
                    {r.detail}
                  </p>
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
                    Sidste år (samme tid)
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

export function AabneOrdrerSection({
  extension,
  layout = "mobile",
}: {
  extension: CompanyLagoExtension | null;
  layout?: SectionLayout;
}) {
  const isLaptop = layout === "laptop";
  const query = useOpenOrders(extension?.visma_customer_no ?? null);
  const orders: OpenOrderSummary[] = query.data?.orders ?? [];
  const totals = query.data?.totals ?? {
    klar: 0,
    afventer: 0,
    enPrimeur: 0,
    iAlt: 0,
  };
  return (
    <Section variant={isLaptop ? "panel" : "divider"}>
      {isLaptop ? (
        <SectionHeader
          variant="label"
          title="Åbne ordrer"
          subtitle={orders.length > 0 ? `${orders.length} aktive` : undefined}
        />
      ) : (
        <SectionHeader
          title="Åbne ordrer"
          right={
            orders.length > 0 ? <Meta>{orders.length} aktive</Meta> : undefined
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
          <RowGroup>
            {orders.slice(0, 5).map((o) => (
              <li key={o.ordre_nr} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-medium text-[var(--fg)]">
                      Ordre #{o.ordre_nr}
                    </span>
                    <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                      · {dateShort(o.ordre_dato)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[var(--fg)] tabular-nums">
                    {kroner.format(o.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
                    Lagerstatus
                  </span>
                  {o.status === "klar" ? (
                    <StatusBadge variant="groen">Klar til levering</StatusBadge>
                  ) : (
                    <StatusBadge variant="gul">Restordre</StatusBadge>
                  )}
                </div>
                {o.restNote && (
                  <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">
                    {o.restNote}
                  </p>
                )}
                {/* Brief 51 §4 (17. sep 2026): ønsket leveringsdato vises
                    KUN når feltet har en værdi. Ugedag med — sælger
                    planlægger i ugedage. Er datoen passeret og ordren
                    stadig åben, står den i --st-red-fg. */}
                {o.oensketLevering && (
                  <p
                    className={cn(
                      "text-[length:var(--t-sec)]",
                      isPastDate(o.oensketLevering)
                        ? "text-[var(--st-red-fg)] font-medium"
                        : "text-[var(--fg-2)]",
                    )}
                  >
                    Ønsket levering: {formatWeekdayDate(o.oensketLevering)}
                  </p>
                )}
              </li>
            ))}
          </RowGroup>
          <OrderTotals totals={totals} />
        </>
      )}
    </Section>
  );
}

/**
 * Brief 75 tillæg C (22. sep 2026) · totalerne under listen.
 *
 * "I alt" og "Klar til levering" står altid. "Afventer ankomst" og
 * "En Primeur" står KUN når de er > 0 — en linje der siger nul er
 * støj (samme regel som alle andre tomme tilstande denne uge).
 *
 * En Primeur står med luft mellem, uden for I alt-summen. Det er ikke
 * en akut forpligtelse; det er en aftale om noget der først findes
 * om halvandet år. At blande den i totalen ville gøre tallet teknisk
 * rigtigt og praktisk misvisende.
 */
function OrderTotals({ totals }: { totals: OpenOrdersTotals }) {
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-[var(--line)] pt-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[var(--fg-2)]">I alt</span>
        <span className="font-medium text-[var(--fg)] tabular-nums">
          {kroner.format(totals.iAlt)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[var(--fg-2)]">Klar til levering</span>
        <span className="font-medium text-[var(--fg)] tabular-nums">
          {kroner.format(totals.klar)}
        </span>
      </div>
      {totals.afventer > 0 && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[var(--fg-2)]">Afventer ankomst</span>
          <span className="font-medium text-[var(--fg)] tabular-nums">
            {kroner.format(totals.afventer)}
          </span>
        </div>
      )}
      {totals.enPrimeur > 0 && (
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-[var(--fg-3)]">En Primeur</span>
          <span className="font-medium text-[var(--fg-3)] tabular-nums">
            {kroner.format(totals.enPrimeur)}
          </span>
        </div>
      )}
    </div>
  );
}

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
