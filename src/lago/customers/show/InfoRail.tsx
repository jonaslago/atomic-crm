import { Pencil, Plus, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

import { Icon } from "@/lago/ui/Icon";
import { useQuery } from "@tanstack/react-query";

import { ownershipOf } from "../fieldOwnership";
import { VismaBadge } from "../VismaBadge";
import {
  fetchOpenSuggestionsForCompany,
  type ChangeSuggestion,
  type FeltSource,
} from "../changeSuggestions";
import { ContactDialog } from "./ContactDialog";
import { ContactStatusBadge } from "./ContactStatusBadge";
import { DetaljerDialog } from "./DetaljerDialog";
import { ProposeChangeButton } from "./ProposeChangeDialog";
import { useSellerLookup } from "@/lago/settings/useSellerLookup";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";
import type {
  ContactSummary,
  LagoCustomerData,
  SaveExtensionInput,
} from "../types";

// Brief 13: segment ejes af CRM, A/B/C er klassificerede, X er
// uklassificeret (default), L er lead.
const SEGMENT_OPTIONS = ["A", "B", "C", "X", "L"] as const;
type Segment = (typeof SEGMENT_OPTIONS)[number];

// Brief 20 pkt 3: labels må aldrig sige "hyppig/standard/sjælden" —
// bogstavet + intervallet i dage (fra Indstillinger) er den ærlige
// beskrivelse. X og L er meta, ikke frekvens, så de beholder deres
// forklarende suffix.
function segmentLabel(
  s: Segment,
  intervalDays: { A: number; B: number; C: number },
): string {
  if (s === "X") return "X · Uklassificeret";
  if (s === "L") return "L · Lead";
  return `${s} · hver ${intervalDays[s]}. dag`;
}

function fullName(c: ContactSummary): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—";
}

function primaryEmail(c: ContactSummary): string | null {
  return c.email_jsonb?.[0]?.email ?? null;
}

function primaryPhone(c: ContactSummary): string | null {
  return c.phone_jsonb?.[0]?.number ?? null;
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  fieldKey?: string;
  /** Brief 46 §2 (16. sep 2026): rå strengværdi til "Foreslå ændring".
   *  Skal reflektere hvad der reelt står i basen — ikke det renderede
   *  React-node (som fx kan være en <a href=tel:>). Kun sat på
   *  VISMA-ejede felter der kan foreslås ændret. */
  rawValue?: string | null;
  companyId?: number;
  companyName?: string;
  feltSource?: FeltSource;
  openSuggestion?: ChangeSuggestion;
  /** #200 §2 (18. sep 2026): opslaget af afventende forslag fejlede.
   *  Vi kan ikke længere skelne "der er ingen forslag" fra "vi ved
   *  det ikke" — blyanten disables så sælgeren ikke opretter en
   *  dublet (brief 46 §2). Banner over sektionen siger det højt. */
  suggestionsFetchFailed?: boolean;
}

/**
 * Brief 37 §2 (16. sep 2026): ingen ikoner pr. felt — de dublerede
 * labelen og gjorde rytmen urolig. Fast rhythm i stedet: samme
 * py-1.5 pr. række, samme label-vægt, samme kolonneopdeling.
 * Kun CRM-ejede felter får mærket — VISMA er standard-ejerforholdet
 * for kunde-master og forklares én gang i toppen af kortet.
 *
 * Brief 46 §2: VISMA-ejede felter får en blyant-knap (kun synlig på
 * hover/focus på bred skærm, altid på telefon) der åbner "Foreslå
 * ændring"-dialogen. Er der allerede et afventende forslag, skjules
 * knappen og der vises en dæmpet oplysningslinje under værdien.
 */
function FieldRow({
  label,
  value,
  fieldKey,
  rawValue,
  companyId,
  companyName,
  feltSource,
  openSuggestion,
  suggestionsFetchFailed,
}: FieldRowProps) {
  const ownership = fieldKey ? ownershipOf(fieldKey) : undefined;
  const isCrmOwned = ownership?.owner === "crm";
  const isVismaOwned = ownership?.owner === "visma";
  const canPropose =
    isVismaOwned &&
    fieldKey != null &&
    companyId != null &&
    companyName != null &&
    feltSource != null;
  return (
    <div className="group grid grid-cols-[7rem_1fr] items-baseline gap-3 py-1.5">
      <div className="flex flex-wrap items-baseline gap-1 text-[13px] text-[var(--fg-2)]">
        <span>{label}</span>
        {isCrmOwned && (
          <span
            className="text-[10px] font-medium uppercase tracking-wide text-[var(--fg-3)]"
            title="Redigeres i CRM (ikke fra VISMA)"
          >
            CRM
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <div className="min-w-0 flex-1 text-sm break-words text-[var(--fg)]">
            {value || <span className="text-[var(--fg-3)]">—</span>}
          </div>
          {canPropose && (
            <ProposeChangeButton
              companyId={companyId!}
              companyName={companyName!}
              felt={fieldKey!}
              feltSource={feltSource!}
              feltLabel={label}
              nuvaerendeVaerdi={rawValue ?? null}
              disabled={openSuggestion != null || !!suggestionsFetchFailed}
            />
          )}
        </div>
        {openSuggestion && (
          <p className="text-[12px] text-[var(--fg-3)]">
            Forslag afventer: {openSuggestion.foreslaaetVaerdi}
            {openSuggestion.foreslaaetAfNavn && ` — ${openSuggestion.foreslaaetAfNavn}`}
            {`, ${formatRelativeDay(openSuggestion.oprettet)}`}
          </p>
        )}
      </div>
    </div>
  );
}

function formatRelativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) /
      86_400_000,
  );
  if (day === 0) return "i dag";
  if (day === 1) return "i går";
  if (day < 7) return `for ${day} dage siden`;
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(d);
}

// Brief 37 §2: hvis kundestamdata mangler, skal sælgeren se det som én
// linje ("Mangler: Distrikt, Faktura-e-mail") — ikke som ti "—"-streger
// spredt ud over kortet. Bunder samler de tomme felter så beslutningen
// om at rette dem er ét klik væk, uden at fjerne felterne fra listen.
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

function CoreInfoCard({ data }: { data: LagoCustomerData }) {
  const translate = useTranslate();
  const sellers = useSellerLookup();
  const { company, extension } = data;
  const salesName =
    sellers.byCode(extension?.visma_sales_code) ??
    extension?.visma_sales_name ??
    null;
  // Brief 37 §5: adressen skal ikke inkludere land — alle kunder er
  // danske, "Danmark" bag byen er ren støj.
  const address = [company.address, company.zipcode, company.city]
    .filter(Boolean)
    .join(", ");
  const mangler = collectMangler(data);

  // Brief 46 §2: hent afventende forslag så FieldRow kan skjule blyant
  // og vise oplysningslinjen når nogen allerede har foreslået noget.
  const suggestionsQuery = useQuery({
    queryKey: ["lago-change-suggestions-company", company.id],
    queryFn: () => fetchOpenSuggestionsForCompany(company.id),
    staleTime: 60_000,
  });
  const openByFelt = new Map<string, ChangeSuggestion>();
  for (const s of suggestionsQuery.data ?? []) {
    openByFelt.set(s.felt, s);
  }
  // #200 §2 (18. sep 2026): fejler forslagsopslaget, kan FieldRow ikke
  // vide om nogen allerede har foreslået noget — brief 46 §2's "To
  // sælgere skal ikke foreslå det samme" bryder tavst. Vi disabler
  // blyanterne og siger det højt over sektionen, indtil listen kan
  // læses igen.
  const suggestionsFetchFailed = suggestionsQuery.isError;
  const rowExtras = (felt: string, source: FeltSource) => ({
    companyId: company.id,
    companyName: company.name,
    feltSource: source,
    openSuggestion: openByFelt.get(felt),
    suggestionsFetchFailed,
  });
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-[var(--fg)]">
          {translate("lago.customer.sections.core_info")}
        </CardTitle>
        {/* Brief 37 §2: én VISMA-sætning i toppen — så vender vi
            standarden om og mærker kun det, sælgeren kan røre. */}
        <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[13px] text-[var(--fg-2)]">
          Kunde-data kommer fra VISMA. Felter mærket
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--fg-3)]">
            CRM
          </span>
          redigeres her.
        </p>
      </CardHeader>
      <CardContent className="pt-1">
        {suggestionsFetchFailed && (
          <p className="mb-2 rounded-[var(--r-2)] border border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)] px-3 py-2 text-[13px] text-[var(--st-amber-fg)]">
            Kan ikke tjekke om der allerede ligger et forslag. Foreslå
            ikke ændringer lige nu — kontakt kontoret, hvis det haster.
          </p>
        )}
        <FieldRow
          label={translate("resources.companies.fields.address")}
          value={address}
          fieldKey="address"
          rawValue={address || null}
          {...rowExtras("address", "companies")}
        />
        <FieldRow
          label={translate("resources.companies.fields.phone_number")}
          value={
            company.phone_number ? (
              <a
                href={`tel:${company.phone_number}`}
                className="text-[var(--ink)] underline-offset-2 hover:underline"
              >
                {company.phone_number}
              </a>
            ) : null
          }
          fieldKey="phone_number"
          rawValue={company.phone_number ?? null}
          {...rowExtras("phone_number", "companies")}
        />
        <FieldRow
          label="Faktura-e-mail"
          value={
            extension?.faktura_email ? (
              <a
                href={`mailto:${extension.faktura_email}`}
                className="text-[var(--ink)] underline-offset-2 hover:underline break-all"
              >
                {extension.faktura_email}
              </a>
            ) : null
          }
          fieldKey="faktura_email"
          rawValue={extension?.faktura_email ?? null}
          {...rowExtras("faktura_email", "companies_lago")}
        />
        <FieldRow
          label={translate("resources.companies.fields.tax_identifier")}
          value={company.tax_identifier}
          fieldKey="tax_identifier"
          rawValue={company.tax_identifier ?? null}
          {...rowExtras("tax_identifier", "companies")}
        />
        <FieldRow
          label="Distrikt"
          value={extension?.distrikt}
          fieldKey="distrikt"
          rawValue={extension?.distrikt ?? null}
          {...rowExtras("distrikt", "companies_lago")}
        />
        <FieldRow
          label="Betaling"
          value={extension?.betaling}
          fieldKey="betaling"
          rawValue={extension?.betaling ?? null}
          {...rowExtras("betaling", "companies_lago")}
        />
        {/* Brief 39 (16. sep 2026): Debitorinfo fra Kundeudtrækket.
            Fri tekst, kan være tom for de fleste kunder. Vises kun
            hvis feltet reelt bærer indhold — undlader den grå "—"
            for at holde CoreInfoCards linjelængde nede for typiske
            kunder uden noter. */}
        {extension?.debitorinfo && (
          <FieldRow
            label="Debitorinfo"
            value={
              <span className="whitespace-pre-wrap">
                {extension.debitorinfo}
              </span>
            }
            fieldKey="debitorinfo"
          />
        )}
        <FieldRow
          label="Ansvarlig sælger"
          value={salesName}
          fieldKey="visma_sales_name"
        />
        <FieldRow
          label="Kundestatus"
          value={
            extension?.is_active === false ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-[var(--fg-3)]"
                />
                Inaktiv
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-[var(--st-green)]"
                />
                Aktiv
              </span>
            )
          }
          fieldKey="is_active"
        />
        <FieldRow
          label={translate("resources.companies.fields.website")}
          value={
            company.website ? (
              <a
                href={
                  company.website.startsWith("http")
                    ? company.website
                    : `https://${company.website}`
                }
                target="_blank"
                rel="noreferrer"
                className="text-[var(--ink)] underline-offset-2 hover:underline"
              >
                {company.website}
              </a>
            ) : null
          }
          fieldKey="website"
        />
        {mangler.length > 0 && (
          <p className="mt-3 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--fg-2)]">
            Mangler:{" "}
            <span className="text-[var(--fg)]">{mangler.join(", ")}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContactsCard({
  companyId,
  companyName,
  contacts,
}: {
  companyId: number;
  companyName?: string;
  contacts: ContactSummary[];
}) {
  const translate = useTranslate();
  // Brief 46 §2 (16. sep 2026): én dialog til både Tilføj og Redigér.
  // dialogOpen = null → lukket; "new" → opret; number → redigér den id.
  const [dialogTarget, setDialogTarget] = useState<"new" | number | null>(null);

  const addButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setDialogTarget("new")}
      className="gap-1"
    >
      <Icon icon={Plus} size="sm" />
      {translate("lago.customer.contacts.add_button", {
        _: "Tilføj kontakt",
      })}
    </Button>
  );

  const dialog = (
    <ContactDialog
      open={dialogTarget !== null}
      onOpenChange={(v) => !v && setDialogTarget(null)}
      companyId={companyId}
      companyName={companyName}
      contactId={typeof dialogTarget === "number" ? dialogTarget : null}
    />
  );

  if (contacts.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Icon icon={Users} className="text-muted-foreground" />
            {translate("lago.customer.sections.contacts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-2 text-sm">
            {translate("lago.customer.empty.no_contacts")}
          </p>
          {addButton}
        </CardContent>
        {dialog}
      </Card>
    );
  }
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={Users} className="text-muted-foreground" />
          {translate("lago.customer.sections.contacts")} ({contacts.length})
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDialogTarget("new")}
          className="gap-1"
        >
          <Icon icon={Plus} size="sm" />
          {translate("lago.customer.contacts.add_button", { _: "Tilføj" })}
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {contacts.map((c) => {
            const email = primaryEmail(c);
            const phone = primaryPhone(c);
            return (
              <li key={c.id} className="group border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{fullName(c)}</span>
                  <ContactStatusBadge status={c.status} />
                  {c.is_webshop_user && (
                    <Badge
                      variant="outline"
                      className="border-[var(--a-deep)] text-[var(--a-deep)] text-xs font-normal"
                      title="Webshop-adgangen styres i VISMA — ikke i CRM'et. Sletning eller navnerettelse her lukker ikke logins."
                    >
                      Webshop-bruger · styres i VISMA
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialogTarget(c.id)}
                    aria-label={`Redigér ${fullName(c)}`}
                    title="Redigér"
                    /* Brief 53 §0 (17. sep 2026): synlig hele tiden på
                       tablet/telefon (ingen mus). Skjult indtil hover
                       kun på mus/trackpad. */
                    className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-3)] hover:bg-[var(--surface-3)] hover:text-[var(--fg-2)] [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100"
                  >
                    <Icon icon={Pencil} size="sm" />
                  </button>
                </div>
                {c.title && (
                  <div className="text-muted-foreground text-sm">{c.title}</div>
                )}
                <div className="mt-1 flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {email}
                    </a>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {phone}
                    </a>
                  )}
                </div>
                <Link
                  to={`/contacts/${c.id}/show`}
                  className="text-primary mt-1 inline-block text-sm underline-offset-2 hover:underline"
                >
                  {translate("lago.customer.timeline.full_contact_page")}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
      {dialog}
    </Card>
  );
}

function CrmFieldsCard({
  data,
  onUpdate,
  saving,
}: {
  data: LagoCustomerData;
  onUpdate: (input: SaveExtensionInput) => void;
  saving: boolean;
}) {
  const translate = useTranslate();
  const intervals = useVisitIntervals();
  const ext = data.extension;
  const [vismaNo, setVismaNo] = useState(ext?.visma_customer_no ?? "");
  const [openingHours, setOpeningHours] = useState(ext?.opening_hours ?? "");
  const [segment, setSegment] = useState<Segment | "">(ext?.segment ?? "");

  const save = () =>
    onUpdate({
      company_id: data.company.id,
      visma_customer_no: vismaNo.trim() || null,
      opening_hours: openingHours.trim() || null,
      segment: (segment as Segment) || null,
    });

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={Sparkles} className="text-muted-foreground" />
          {translate("lago.customer.sections.crm_fields")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visma_no" className="flex items-center text-sm">
              {translate("lago.customer.fields.visma_customer_no")}
              <VismaBadge size="xs" />
            </Label>
            <Input
              id="visma_no"
              value={vismaNo}
              onChange={(e) => setVismaNo(e.target.value)}
              placeholder="fx 10042"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment" className="text-sm">
              {translate("lago.customer.fields.segment")}
            </Label>
            <Select
              value={segment}
              onValueChange={(v) => setSegment(v as Segment | "")}
            >
              <SelectTrigger id="segment">
                <SelectValue
                  placeholder={translate(
                    "lago.customer.fields.segment_placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {segmentLabel(s, intervals.intervalDays)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opening_hours" className="text-sm">
              {translate("lago.customer.fields.opening_hours")}
            </Label>
            <Input
              id="opening_hours"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder={translate(
                "lago.customer.fields.opening_hours_placeholder",
              )}
            />
          </div>
          <Separator />
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Icon icon={Loader2} className="mr-2 animate-spin" />}
            {translate("lago.customer.actions.save_crm_fields")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Brief 37 §6 (16. sep 2026): CrmFieldsCard er skjult fra kundekortet
// før felttesten. Sælgeren skal ikke ret VISMA-nr, åbningstider eller
// segment ude i felten; det er backoffice-handlinger og ligger allerede
// bag Registrér-modalen. Komponenten består herunder — bare ikke
// renderet — så vi kan slå den til igen uden refactoring.
void CrmFieldsCard;

export function InfoRailCards({
  data,
  onUpdate: _onUpdate,
  saving: _saving,
}: {
  data: LagoCustomerData;
  onUpdate: (input: SaveExtensionInput) => void;
  saving: boolean;
}) {
  return (
    <>
      <CoreInfoCard data={data} />
      <DetaljerCard data={data} />
      <ContactsCard
        companyId={data.company.id}
        companyName={data.company.name}
        contacts={data.contacts}
      />
    </>
  );
}

function DetaljerCard({ data }: { data: LagoCustomerData }) {
  const [open, setOpen] = useState(false);
  const initial = {
    sector: data.company.sector ?? null,
    opening_hours: data.extension?.opening_hours ?? null,
    description: data.company.description ?? null,
  };
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Åbningstider", value: initial.opening_hours },
    { label: "Branche", value: initial.sector },
    { label: "Noter", value: initial.description },
  ];
  const allEmpty = rows.every((r) => !r.value?.trim());
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={Sparkles} className="text-muted-foreground" />
          Detaljer
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1"
        >
          <Icon icon={Pencil} size="sm" />
          Redigér
        </Button>
      </CardHeader>
      <CardContent>
        {allEmpty ? (
          <p className="py-2 text-sm text-[var(--fg-2)]">
            Ingen detaljer endnu. Klik Redigér for at tilføje åbningstider,
            branche eller noter.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-[var(--fg-2)]">{r.label}</dt>
                <dd className="whitespace-pre-wrap text-[var(--fg)]">
                  {r.value?.trim() || <span className="text-[var(--fg-3)]">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
      <DetaljerDialog
        open={open}
        onOpenChange={setOpen}
        companyId={data.company.id}
        initial={initial}
      />
    </Card>
  );
}

/** Segment badge used by the header — extracted so both the header and
 * portrait sticky-bar can render it consistently. */
export function SegmentBadge({
  segment,
}: {
  segment: "A" | "B" | "C" | "X" | "L" | null | undefined;
}) {
  const translate = useTranslate();
  if (!segment) return null;
  return (
    <Badge variant="secondary" className="font-normal">
      {translate("lago.customer.segment")} {segment}
    </Badge>
  );
}
