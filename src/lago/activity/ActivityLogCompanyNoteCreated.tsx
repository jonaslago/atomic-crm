import { useGetIdentity, useRecordContext, useTranslate } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Badge } from "@/components/ui/badge";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { ActivityLogNote } from "@/components/atomic-crm/activity/ActivityLogNote";
import { useActivityLogContext } from "@/components/atomic-crm/activity/ActivityLogContext";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { useGetSalesName } from "@/components/atomic-crm/sales/useGetSalesName";
import type { Company, Contact } from "@/components/atomic-crm/types";

import type { ActivityCompanyNoteCreated } from "./types";

function CompanyAvatarSlot() {
  const record = useRecordContext<Company>();
  return <CompanyAvatar width={20} height={20} record={record} />;
}

function AboutContactBadge() {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();
  const name =
    [record?.first_name, record?.last_name].filter(Boolean).join(" ").trim() ||
    "";
  if (!name) return null;
  return (
    <Badge variant="outline" className="ml-1 font-normal">
      {translate("lago.customer.note.about_contact", { name })}
    </Badge>
  );
}

/**
 * Renderer for our LAGO `companyNote.created` activity row, slotted into
 * the same feed as upstream's company/contact/deal/note rows. Mirrors the
 * upstream contact-note renderer so the visual treatment matches: company
 * avatar → "[seller] added a note on [company]" → relative date → optional
 * "om [contact]" badge when a contact was tagged, then the note text inside
 * the shared ActivityLogNote shell with a link to the LAGO customer page.
 */
export function ActivityLogCompanyNoteCreated({
  activity,
}: {
  activity: ActivityCompanyNoteCreated;
}) {
  const context = useActivityLogContext();
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { companyNote } = activity;
  const isCurrentUser = activity.sales_id === identity?.id;
  const salesName = useGetSalesName(activity.sales_id ?? null, {
    enabled: !isCurrentUser,
  });
  const link = `/companies/${companyNote.company_id}/show`;

  return (
    <ActivityLogNote
      header={
        <div className="flex w-full items-start gap-2">
          <ReferenceField
            source="company_id"
            reference="companies"
            record={companyNote}
          >
            <CompanyAvatarSlot />
          </ReferenceField>

          <span className="text-muted-foreground flex-grow text-sm">
            {translate(
              isCurrentUser
                ? "lago.activity.you_added_company_note"
                : "lago.activity.added_company_note",
              { name: salesName },
            )}{" "}
            <ReferenceField
              source="company_id"
              reference="companies"
              record={companyNote}
            >
              <TextField source="name" />
            </ReferenceField>
            {context !== "company" && (
              <>
                {" "}
                <RelativeDate date={activity.date} />
              </>
            )}
            {companyNote.contact_id != null && (
              <ReferenceField
                source="contact_id"
                reference="contacts"
                record={companyNote}
              >
                <AboutContactBadge />
              </ReferenceField>
            )}
          </span>

          {context === "company" && (
            <span className="text-muted-foreground text-sm">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={companyNote.text}
      link={link}
    />
  );
}
