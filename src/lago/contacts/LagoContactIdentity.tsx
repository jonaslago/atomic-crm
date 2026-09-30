import { Linkedin, Mail, Pencil, Phone, User } from "lucide-react";
import { useRecordContext, useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";

import { VismaBadge } from "@/lago/customers/VismaBadge";
import { ownershipOf } from "@/lago/customers/fieldOwnership";
import { Icon } from "@/lago/ui/Icon";

interface IdentityRowProps {
  icon: React.ReactNode;
  label: string;
  fieldKey: string;
  value: React.ReactNode | null | undefined;
  emptyText: string;
}

/**
 * A single VISMA-aware row on the LAGO contact identity card. Renders
 * the field label with a small VISMA badge when the ownership manifest
 * classifies it as VISMA-owned. Empty values show a muted tom-tilstand
 * instead of nothing — same pattern as the customer page.
 */
function IdentityRow({
  icon,
  label,
  fieldKey,
  value,
  emptyText,
}: IdentityRowProps) {
  const ownership = ownershipOf(fieldKey);
  const isVisma = ownership?.owner === "visma";
  const hasValue =
    value != null &&
    (typeof value !== "string" || value.trim().length > 0);
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex items-center text-sm">
          {label}
          {isVisma && <VismaBadge size="xs" />}
        </div>
        <div
          className={cn(
            "text-sm break-words",
            !hasValue && "text-muted-foreground italic",
            isVisma && !hasValue && "",
          )}
        >
          {hasValue ? value : emptyText}
        </div>
      </div>
    </div>
  );
}

/**
 * VISMA-locked identity card for the LAGO contact show. Displays name,
 * title, phone(s) and e-mail(s) with the yellow 🔒 VISMA badge — the
 * same visual pattern used on the customer page. The show page is
 * read-only by nature, so no input is disabled; when the VISMA sync
 * goes live we bump `readOnly: true` in the ownership manifest.
 */
export function LagoContactIdentity() {
  const translate = useTranslate();
  const record = useRecordContext<Contact>();
  if (!record) return null;

  const fullName =
    [record.first_name, record.last_name].filter(Boolean).join(" ").trim() ||
    "—";

  const primaryEmail = record.email_jsonb?.[0]?.email;
  const primaryPhone = record.phone_jsonb?.[0]?.number;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">
          {translate("lago.contact.section_identity")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <IdentityRow
          icon={<Icon icon={User} />}
          label={translate("resources.contacts.fields.first_name", {
            _: "Navn",
          })}
          fieldKey="first_name"
          value={fullName}
          emptyText="—"
        />
        <IdentityRow
          icon={<Icon icon={Pencil} size="sm" />}
          label={translate("resources.contacts.fields.title", {
            _: "Titel",
          })}
          fieldKey="title"
          value={record.title}
          emptyText={translate("lago.contact.empty_title")}
        />
        <IdentityRow
          icon={<Icon icon={Mail} />}
          label={translate("resources.contacts.fields.email_jsonb", {
            _: "E-mail",
          })}
          fieldKey="email_jsonb"
          value={
            primaryEmail ? (
              <a
                href={`mailto:${primaryEmail}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {primaryEmail}
              </a>
            ) : null
          }
          emptyText={translate("lago.contact.empty_email")}
        />
        <IdentityRow
          icon={<Icon icon={Phone} />}
          label={translate("resources.contacts.fields.phone_jsonb", {
            _: "Telefon",
          })}
          fieldKey="phone_jsonb"
          value={
            primaryPhone ? (
              <a
                href={`tel:${primaryPhone}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {primaryPhone}
              </a>
            ) : null
          }
          emptyText={translate("lago.contact.empty_phone")}
        />
        {record.linkedin_url && (
          <IdentityRow
            icon={<Icon icon={Linkedin} />}
            label="LinkedIn"
            fieldKey="linkedin_url"
            value={
              <a
                href={record.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                LinkedIn
              </a>
            }
            emptyText="—"
          />
        )}
      </CardContent>
    </Card>
  );
}
