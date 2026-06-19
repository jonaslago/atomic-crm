import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck2,
  CalendarClock,
  Loader2,
  MapPin,
  Phone,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fetchLagoCustomer, upsertLagoExtension } from "./dataAccess";
import { ownershipOf } from "./fieldOwnership";
import type {
  ContactSummary,
  LagoCustomerData,
  OpenTask,
  RecentNote,
  SaveExtensionInput,
} from "./types";
import { VismaBadge } from "./VismaBadge";

const SEGMENT_OPTIONS = ["A", "B", "C"] as const;
type Segment = (typeof SEGMENT_OPTIONS)[number];

function formatDate(value: string | null | undefined, locale = "da-DK") {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
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
  icon?: React.ReactNode;
}

function FieldRow({ label, value, fieldKey, icon }: FieldRowProps) {
  const ownership = fieldKey ? ownershipOf(fieldKey) : undefined;
  const visma = ownership?.owner === "visma";
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && (
        <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-muted-foreground flex items-center text-xs">
          {label}
          {visma && <VismaBadge size="xs" />}
        </div>
        <div className="text-sm break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CustomerHeader({ data }: { data: LagoCustomerData }) {
  const translate = useTranslate();
  const navigate = useNavigate();
  const { company, extension } = data;
  return (
    <div className="bg-background sticky top-0 z-10 border-b">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/companies")}
        >
          ← {translate("ra.action.back", { _: "Tilbage" })}
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold sm:text-xl">
            {company.name}
          </h1>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {extension?.visma_customer_no ? (
              <span>
                {translate("lago.customer.visma_no")}:{" "}
                <span className="font-mono">{extension.visma_customer_no}</span>
              </span>
            ) : (
              <span className="italic">
                {translate("lago.customer.no_visma_no")}
              </span>
            )}
            {extension?.segment && (
              <Badge variant="secondary" className="font-normal">
                {translate("lago.customer.segment")} {extension.segment}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoreInfoSection({ data }: { data: LagoCustomerData }) {
  const translate = useTranslate();
  const { company } = data;
  const address = [
    company.address,
    company.zipcode,
    company.city,
    company.country,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <SectionCard
      title={translate("lago.customer.sections.core_info")}
      icon={<MapPin className="h-4 w-4" />}
    >
      <FieldRow
        label={translate("resources.companies.fields.address")}
        value={address}
        fieldKey="address"
      />
      <FieldRow
        label={translate("resources.companies.fields.phone_number")}
        value={
          company.phone_number ? (
            <a
              href={`tel:${company.phone_number}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {company.phone_number}
            </a>
          ) : null
        }
        fieldKey="phone_number"
        icon={<Phone className="h-4 w-4" />}
      />
      <FieldRow
        label={translate("resources.companies.fields.tax_identifier")}
        value={company.tax_identifier}
        fieldKey="tax_identifier"
      />
      <FieldRow
        label={translate("resources.companies.fields.sector")}
        value={company.sector}
        fieldKey="sector"
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
              className="text-primary underline-offset-2 hover:underline"
            >
              {company.website}
            </a>
          ) : null
        }
        fieldKey="website"
      />
    </SectionCard>
  );
}

function LastVisitSection({
  data,
  onUpdate,
  saving,
}: {
  data: LagoCustomerData;
  onUpdate: (input: SaveExtensionInput) => void;
  saving: boolean;
}) {
  const translate = useTranslate();
  const ext = data.extension;
  const markVisitToday = () =>
    onUpdate({
      company_id: data.company.id,
      last_visit_at: new Date().toISOString(),
    });

  return (
    <SectionCard
      title={translate("lago.customer.sections.last_visit")}
      icon={<CalendarCheck2 className="h-4 w-4" />}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={markVisitToday}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          {translate("lago.customer.actions.mark_visited_today")}
        </Button>
      }
    >
      <FieldRow
        label={translate("lago.customer.fields.last_visit_at")}
        value={ext?.last_visit_at ? formatDate(ext.last_visit_at) : null}
        fieldKey="last_visit_at"
      />
      <FieldRow
        label={translate("lago.customer.fields.next_visit_planned")}
        value={
          ext?.next_visit_planned ? formatDate(ext.next_visit_planned) : null
        }
        fieldKey="next_visit_planned"
        icon={<CalendarClock className="h-4 w-4" />}
      />
    </SectionCard>
  );
}

function OpenTasksSection({ tasks }: { tasks: OpenTask[] }) {
  const translate = useTranslate();
  if (tasks.length === 0) {
    return (
      <SectionCard
        title={translate("lago.customer.sections.open_followups")}
        icon={<Sparkles className="h-4 w-4" />}
      >
        <p className="text-muted-foreground py-2 text-sm">
          {translate("lago.customer.empty.no_open_tasks")}
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={`${translate("lago.customer.sections.open_followups")} (${tasks.length})`}
      icon={<Sparkles className="h-4 w-4" />}
    >
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="border-b pb-2 last:border-b-0 last:pb-0">
            <div className="text-sm font-medium">{t.text}</div>
            <div className="text-muted-foreground text-xs">
              {t.due_date ? formatDate(t.due_date) : "—"}
              {t.type && <span className="ml-2">· {t.type}</span>}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ContactsSection({ contacts }: { contacts: ContactSummary[] }) {
  const translate = useTranslate();
  if (contacts.length === 0) {
    return (
      <SectionCard
        title={translate("lago.customer.sections.contacts")}
        icon={<Users className="h-4 w-4" />}
      >
        <p className="text-muted-foreground py-2 text-sm">
          {translate("lago.customer.empty.no_contacts")}
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={`${translate("lago.customer.sections.contacts")} (${contacts.length})`}
      icon={<Users className="h-4 w-4" />}
    >
      <ul className="space-y-3">
        {contacts.map((c) => {
          const email = primaryEmail(c);
          const phone = primaryPhone(c);
          return (
            <li key={c.id} className="border-b pb-3 last:border-b-0 last:pb-0">
              <div className="text-sm font-medium">{fullName(c)}</div>
              {c.title && (
                <div className="text-muted-foreground text-xs">{c.title}</div>
              )}
              <div className="mt-1 flex flex-col gap-1 text-xs sm:flex-row sm:gap-3">
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
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function NotesSection({ notes }: { notes: RecentNote[] }) {
  const translate = useTranslate();
  if (notes.length === 0) {
    return (
      <SectionCard
        title={translate("lago.customer.sections.recent_notes")}
        icon={<StickyNote className="h-4 w-4" />}
      >
        <p className="text-muted-foreground py-2 text-sm">
          {translate("lago.customer.empty.no_notes")}
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={translate("lago.customer.sections.recent_notes")}
      icon={<StickyNote className="h-4 w-4" />}
    >
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="border-b pb-3 last:border-b-0 last:pb-0">
            <div className="text-muted-foreground text-xs">
              {formatDate(n.date)}
            </div>
            <div className="text-sm whitespace-pre-wrap">{n.text}</div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function PurchaseHistoryPlaceholder() {
  const translate = useTranslate();
  return (
    <SectionCard
      title={translate("lago.customer.sections.purchase_history")}
      icon={<ShoppingBag className="h-4 w-4" />}
    >
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
        {translate("lago.customer.empty.purchase_history_pending_visma")}
      </div>
    </SectionCard>
  );
}

function CrmFieldsSection({
  data,
  onUpdate,
  saving,
}: {
  data: LagoCustomerData;
  onUpdate: (input: SaveExtensionInput) => void;
  saving: boolean;
}) {
  const translate = useTranslate();
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
    <SectionCard
      title={translate("lago.customer.sections.crm_fields")}
      icon={<Sparkles className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="visma_no" className="flex items-center text-xs">
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
          <Label htmlFor="segment" className="text-xs">
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
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="opening_hours" className="text-xs">
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
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {translate("lago.customer.actions.save_crm_fields")}
        </Button>
      </div>
    </SectionCard>
  );
}

/**
 * Mobile-first kerne-kundebillede for sælgere på iPad (Domain-brief 1).
 * Used as the show component for the `companies` resource via the
 * `companyShow` prop on `<CRM>` in App.tsx.
 */
export function LagoCustomerShow() {
  const params = useParams<{ id: string }>();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const companyId = params.id ? Number(params.id) : NaN;

  const query = useQuery({
    queryKey: ["lago-customer", companyId],
    queryFn: () => fetchLagoCustomer(companyId),
    enabled: Number.isFinite(companyId),
  });

  const mutation = useMutation({
    mutationFn: upsertLagoExtension,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["lago-customer", companyId],
      }),
  });

  if (!Number.isFinite(companyId)) {
    return (
      <div className="p-6 text-sm text-destructive">
        {translate("lago.customer.errors.bad_id")}
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {translate("lago.customer.loading")}
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="p-6 text-sm text-destructive">
        {translate("lago.customer.errors.load_failed", {
          _: "Kunne ikke hente kunden.",
        })}{" "}
        {(query.error as Error | undefined)?.message}
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="max-w-3xl">
      <CustomerHeader data={data} />
      <div className="px-4 py-4">
        <CoreInfoSection data={data} />
        <LastVisitSection
          data={data}
          onUpdate={mutation.mutate}
          saving={mutation.isPending}
        />
        <OpenTasksSection tasks={data.openTasks} />
        <ContactsSection contacts={data.contacts} />
        <NotesSection notes={data.recentNotes} />
        <CrmFieldsSection
          data={data}
          onUpdate={mutation.mutate}
          saving={mutation.isPending}
        />
        <PurchaseHistoryPlaceholder />
      </div>
    </div>
  );
}
