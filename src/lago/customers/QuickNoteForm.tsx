import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createContactNote } from "./dataAccess";
import type { ContactSummary } from "./types";

interface QuickNoteFormProps {
  /** First contact of the company — note is attached to them. */
  primaryContact: ContactSummary | undefined;
  /** Invalidate key for the LAGO customer page query so the new note appears. */
  invalidateKey: ReadonlyArray<unknown>;
}

/**
 * FS-4: quick-add note from the customer page without navigating into a
 * contact. Writes to public.contact_notes against the first contact in the
 * company; if the company has no contacts yet, the form is disabled with
 * a hint instead of crashing.
 */
export function QuickNoteForm({
  primaryContact,
  invalidateKey,
}: QuickNoteFormProps) {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: createContactNote,
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  if (!primaryContact) {
    return (
      <p className="text-muted-foreground border-muted-foreground/30 mt-1 rounded-md border border-dashed p-3 text-xs">
        {translate("lago.customer.quick_note.needs_contact")}
      </p>
    );
  }

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    mutation.mutate({
      contact_id: primaryContact.id,
      text: trimmed,
      sales_id: typeof identity?.id === "number" ? identity.id : undefined,
    });
  };

  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor="quick-note" className="text-xs">
        {translate("lago.customer.quick_note.label", {
          name: [primaryContact.first_name, primaryContact.last_name]
            .filter(Boolean)
            .join(" "),
        })}
      </Label>
      <textarea
        id="quick-note"
        rows={2}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={translate("lago.customer.quick_note.placeholder")}
      />
      <div className="flex items-center justify-end gap-2">
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
  );
}
