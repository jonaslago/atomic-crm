import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createCompanyNote } from "./dataAccess";
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
}: QuickNoteFormProps) {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const [text, setText] = useState("");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);

  const mutation = useMutation({
    mutationFn: createCompanyNote,
    onSuccess: () => {
      setText("");
      setContactId(NO_CONTACT);
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
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
      <Label htmlFor="quick-note" className="text-xs">
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
            <Label htmlFor="quick-note-contact" className="text-xs">
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
            <span className="text-destructive text-xs">
              {translate("lago.customer.quick_note.save_failed")}
            </span>
          )}
          <Button
            size="sm"
            onClick={submit}
            disabled={!text.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3 w-3" />
            )}
            {translate("lago.customer.quick_note.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
