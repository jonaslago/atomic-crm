import { useState } from "react";
import {
  InfiniteListBase,
  RecordRepresentation,
  ShowBase,
  useShowContext,
  useTranslate,
} from "ra-core";
import type { ShowBaseProps } from "ra-core";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

import { Icon } from "@/lago/ui/Icon";
import { MobileBackButton } from "@/components/atomic-crm/misc/MobileBackButton";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactBackgroundInfo } from "@/components/atomic-crm/contacts/ContactBackgroundInfo";
import { ContactEditSheet } from "@/components/atomic-crm/contacts/ContactEditSheet";
import { ContactStatusSelector } from "@/components/atomic-crm/contacts/ContactInputs";
import { ContactTasksList } from "@/components/atomic-crm/contacts/ContactTasksList";
import { TagsListEdit } from "@/components/atomic-crm/contacts/TagsListEdit";
import {
  NoteCreate,
  NotesIterator,
  NotesIteratorMobile,
} from "@/components/atomic-crm/notes";
import { NoteCreateSheet } from "@/components/atomic-crm/notes/NoteCreateSheet";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { TasksIterator } from "@/components/atomic-crm/tasks/TasksIterator";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { EditButton } from "@/components/admin/edit-button";
import type { Contact } from "@/components/atomic-crm/types";

import { useHasSideRail } from "@/lago/layout/useHasSideRail";

import { LagoContactIdentity } from "./LagoContactIdentity";
import { LagoWorksAtLink } from "./LagoWorksAtLink";

/**
 * LAGO contact show — light LAGO-tur per Domain-brief 4. Same functional
 * surface as upstream's ContactShow (notes tab, tasks tab, details tab,
 * plus status/tags/background editing) but wrapped in the LAGO card /
 * typography system, with:
 *  - VISMA badge + read-only shell on VISMA-owned identity fields
 *    (name, title, phone, e-mail) via LagoContactIdentity
 *  - a prominent "arbejder hos [kunde] →" link to the LAGO customer page
 *  - landscape-first two-column layout + portrait fallback
 * Everything else — Atomic status/tags/notes/tasks/background — is
 * preserved verbatim via upstream components.
 */
export function LagoContactShow(props: ShowBaseProps = {}) {
  const isMobile = useIsMobile();
  return (
    <ShowBase
      queryOptions={{
        onError: isMobile
          ? () => {
              // Mobile handles offline in-view
            }
          : undefined,
      }}
      {...props}
    >
      {isMobile ? <LagoContactShowMobile /> : <LagoContactShowDesktop />}
    </ShowBase>
  );
}

function LagoContactShowDesktop() {
  const translate = useTranslate();
  const hasSideRail = useHasSideRail();
  const { record, isPending } = useShowContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="mb-4 flex items-start gap-4 px-4 pt-4">
        <Avatar />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            <RecordRepresentation />
          </h1>
          {record.title && (
            <p className="text-muted-foreground text-sm">{record.title}</p>
          )}
        </div>
        <EditButton label="resources.contacts.action.edit" />
      </div>

      <div
        className={
          hasSideRail
            ? "grid grid-cols-12 gap-6 px-4 pb-6"
            : "flex flex-col gap-6 px-4 pb-6"
        }
      >
        <aside
          className={hasSideRail ? "col-span-4 space-y-4" : "space-y-4"}
        >
          <LagoWorksAtLink />
          <LagoContactIdentity />
          <Section title={translate("resources.notes.fields.status")}>
            <ContactStatusSelector />
          </Section>
          <Section title={translate("resources.tags.name", { smart_count: 2 })}>
            <TagsListEdit />
          </Section>
          <Section
            title={translate("resources.contacts.field_categories.background_info")}
          >
            <ContactBackgroundInfo />
          </Section>
          <Section title={translate("resources.tasks.name", { smart_count: 2 })}>
            <ReferenceManyField
              target="contact_id"
              reference="tasks"
              sort={{ field: "due_date", order: "ASC" }}
              perPage={1000}
            >
              <TasksIterator />
            </ReferenceManyField>
            <AddTask />
          </Section>
        </aside>

        <main
          className={hasSideRail ? "col-span-8" : "flex-1"}
        >
          <Card>
            <CardContent className="pt-6">
              <InfiniteListBase
                resource="contact_notes"
                filter={{ contact_id: record.id }}
                sort={{ field: "date", order: "DESC" }}
                perPage={25}
                disableSyncWithLocation
                storeKey={false}
                empty={
                  <NoteCreate
                    reference="contacts"
                    showStatus
                    className="mt-2"
                  />
                }
              >
                <NotesIterator reference="contacts" showStatus />
              </InfiniteListBase>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="mb-2 text-sm font-bold">{title}</h3>
        <Separator className="mb-3" />
        {children}
      </CardContent>
    </Card>
  );
}

function LagoContactShowMobile() {
  const translate = useTranslate();
  const { defaultTitle, record, isPending } = useShowContext<Contact>();
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (isPending || !record) return null;

  const taskCount = record.nb_tasks ?? 0;

  return (
    <>
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={record.id}
      />
      <ContactEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      {/* Brief 38 §1 (16. sep 2026): LagoHeader er appens eneste header
          på alle bredder — tidligere dublerede vi den med en fixed
          MobileHeader og dækkede synk-linjen. Tilbage-knappen +
          rediger-knappen sidder nu i toppen af selve indholdet. */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <MobileBackButton />
          <Link to="/contacts" className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{defaultTitle}</h2>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 rounded-full"
            aria-label={translate("ra.action.edit")}
            onClick={() => setEditOpen(true)}
          >
            <Icon icon={Pencil} />
          </Button>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <Avatar />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold">
              <RecordRepresentation />
            </h2>
            {record.title && (
              <p className="text-muted-foreground text-sm">{record.title}</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <LagoWorksAtLink />
        </div>

        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid h-10 w-full grid-cols-3">
            <TabsTrigger value="notes">
              {translate("resources.notes.name", { smart_count: 2 })}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              {translate("crm.common.task_count", {
                smart_count: taskCount ?? 0,
              })}
            </TabsTrigger>
            <TabsTrigger value="details">
              {translate("crm.common.details")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-2">
            <InfiniteListBase
              resource="contact_notes"
              filter={{ contact_id: record.id }}
              sort={{ field: "date", order: "DESC" }}
              perPage={25}
              disableSyncWithLocation
              storeKey={false}
              empty={
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {translate("resources.notes.empty")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setNoteCreateOpen(true)}
                  >
                    {translate("resources.notes.action.add")}
                  </Button>
                </div>
              }
              loading={false}
              error={false}
              queryOptions={{
                onError: () => {
                  // handled in NotesIteratorMobile
                },
              }}
            >
              <NotesIteratorMobile contactId={record.id} showStatus />
            </InfiniteListBase>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <ContactTasksList />
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <div className="space-y-4">
              <LagoContactIdentity />
              <Section title={translate("resources.notes.fields.status")}>
                <ContactStatusSelector />
              </Section>
              <Section
                title={translate("resources.tags.name", { smart_count: 2 })}
              >
                <TagsListEdit />
              </Section>
              <Section
                title={translate(
                  "resources.contacts.field_categories.background_info",
                )}
              >
                <ContactBackgroundInfo />
              </Section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
