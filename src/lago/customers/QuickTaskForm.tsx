import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTask } from "./dataAccess";
import type { ContactSummary } from "./types";

function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface QuickTaskFormProps {
  primaryContact: ContactSummary | undefined;
  invalidateKey: ReadonlyArray<unknown>;
}

/**
 * FS-8: set a "next step" from the customer page. Creates a row in
 * public.tasks attached to the company's first contact so the new task
 * shows up in the open follow-ups list immediately.
 */
export function QuickTaskForm({
  primaryContact,
  invalidateKey,
}: QuickTaskFormProps) {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState(tomorrowISODate());

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      setText("");
      setDueDate(tomorrowISODate());
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  if (!primaryContact) {
    return (
      <p className="text-muted-foreground border-muted-foreground/30 mb-3 rounded-md border border-dashed p-3 text-xs">
        {translate("lago.customer.quick_task.needs_contact")}
      </p>
    );
  }

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !dueDate) return;
    mutation.mutate({
      contact_id: primaryContact.id,
      text: trimmed,
      due_date: new Date(`${dueDate}T12:00:00Z`).toISOString(),
      sales_id: typeof identity?.id === "number" ? identity.id : undefined,
    });
  };

  return (
    <div className="mb-4 space-y-2 rounded-md border border-dashed p-3">
      <Label htmlFor="quick-task-text" className="text-xs">
        {translate("lago.customer.quick_task.label")}
      </Label>
      <Input
        id="quick-task-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={translate("lago.customer.quick_task.placeholder")}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="quick-task-date" className="text-xs">
            {translate("lago.customer.quick_task.due_date")}
          </Label>
          <Input
            id="quick-task-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          onClick={submit}
          disabled={!text.trim() || !dueDate || mutation.isPending}
          className="sm:self-end"
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <CalendarPlus className="mr-1 h-3 w-3" />
          )}
          {translate("lago.customer.quick_task.submit")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-destructive text-xs">
          {translate("lago.customer.quick_task.save_failed")}
        </p>
      )}
    </div>
  );
}
