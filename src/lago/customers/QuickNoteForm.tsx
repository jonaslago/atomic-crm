import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { createCompanyNote, deleteCompanyNote } from "./dataAccess";
import type { ContactSummary } from "./types";

// Sentinel value used by the contact selector to mean "no specific person".
// shadcn's <Select> needs a non-empty string for each <SelectItem>.
const NO_CONTACT = "__none__";

interface QuickNoteFormProps {
  companyId: number;
  /** Available contacts the user can optionally tag the note with. */
  contacts: ContactSummary[];
  /** Invalidate key for the LAGO customer page query so the new note appears. */
  invalidateKey: ReadonlyArray<unknown>;
  /** Brief 40 tillæg B (16. sep 2026): til toast-kvitteringen. */
  companyName?: string;
}

/**
 * FS-4: quick-add note from the customer page. The note belongs to the
 * company (LAGO's own company_notes_lago table), with an OPTIONAL contact
 * tag for cases where the conversation actually was with a specific person.
 */
export function QuickNoteForm({
  companyId,
  contacts,
  invalidateKey,
  companyName,
}: QuickNoteFormProps) {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const [text, setText] = useState("");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);

  const mutation = useMutation({
    mutationFn: createCompanyNote,
    onSuccess: (result) => {
      setText("");
      setContactId(NO_CONTACT);
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      // Brief 40 tillæg B: samme kvittering-mønster som QuickTaskForm.
      // "Ligger i tidslinjen" er stedet noten kan efterprøves.
      const where = companyName ? ` på ${companyName}` : "";
      toast.success(`Notat gemt${where}`, {
        description: "Ligger i tidslinjen",
        action: {
          label: "Fortryd",
          onClick: () => {
            void deleteCompanyNote(result.id).then(
              () => {
                queryClient.invalidateQueries({ queryKey: invalidateKey });
                toast.success("Notatet er fortrudt");
              },
              (err) => {
                toast.error("Kunne ikke fortryde notatet", {
                  description: readErrorMessage(err),
                });
              },
            );
          },
        },
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme notatet", {
        description: readErrorMessage(err),
      }),
  });

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    mutation.mutate({
      company_id: companyId,
      text: trimmed,
      contact_id: contactId === NO_CONTACT ? null : Number(contactId),
      sales_id: typeof identity?.id === "number" ? identity.id : undefined,
    });
  };

  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor="quick-note" className="text-sm">
        {translate("lago.customer.quick_note.label")}
      </Label>
      <textarea
        id="quick-note"
        rows={2}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={translate("lago.customer.quick_note.placeholder")}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {contacts.length > 0 && (
          <div className="flex-1 space-y-1">
            <Label htmlFor="quick-note-contact" className="text-sm">
              {translate("lago.customer.quick_note.contact_label")}
            </Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="quick-note-contact">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>
                  {translate("lago.customer.quick_note.contact_none")}
                </SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      `#${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 sm:self-end">
          {mutation.isError && (
            <span className="text-destructive text-sm">
              {translate("lago.customer.quick_note.save_failed")}
            </span>
          )}
          <Button
            size="sm"
            onClick={submit}
            disabled={!text.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <Icon icon={Loader2} size="sm" className="mr-2 animate-spin" />
            ) : (
              <Icon icon={Plus} size="sm" className="mr-1" />
            )}
            {translate("lago.customer.quick_note.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
