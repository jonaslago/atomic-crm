import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { createTask, deleteTask } from "./dataAccess";
import type { ContactSummary } from "./types";

const DEFAULT_TYPE = "call";

function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface QuickTaskFormProps {
  primaryContact: ContactSummary | undefined;
  invalidateKey: ReadonlyArray<unknown>;
  /** Brief 40 tillæg B (16. sep 2026): bruges i toast-kvitteringen så
   *  sælgeren ser hvor opgaven havnede. */
  companyName?: string;
}

/**
 * FS-8: set a "next step" from the customer page. Creates a row in
 * public.tasks attached to the company's first contact so the new task
 * shows up in the open follow-ups list immediately.
 */
export function QuickTaskForm({
  primaryContact,
  invalidateKey,
  companyName,
}: QuickTaskFormProps) {
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const { taskTypes } = useConfigurationContext();
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState(tomorrowISODate());
  const [taskType, setTaskType] = useState<string>(DEFAULT_TYPE);

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: (result) => {
      setText("");
      setDueDate(tomorrowISODate());
      setTaskType(DEFAULT_TYPE);
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      // Brief 40 tillæg B (16. sep 2026): kvittering med sted + fortryd.
      // Uden dette blev opgaven gemt lydløst — feltet tømtes, knappen
      // blev grå, og brugeren kunne ikke skelne "gemt" fra "forsvandt".
      // "Dukker op under Hvad lovede jeg sidst" siger hvor opgaven kan
      // efterprøves — brugeren har ikke set den nogen andre steder.
      const where = companyName ? ` på ${companyName}` : "";
      toast.success(`Opgave tilføjet${where}`, {
        description: 'Dukker op under "Hvad lovede jeg sidst"',
        action: {
          label: "Fortryd",
          onClick: () => {
            void deleteTask(result.id).then(
              () => {
                queryClient.invalidateQueries({ queryKey: invalidateKey });
                toast.success("Opgaven er fortrudt");
              },
              (err) => {
                toast.error("Kunne ikke fortryde opgaven", {
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
      toast.error("Kunne ikke gemme opgaven", {
        description: readErrorMessage(err),
      }),
  });

  if (!primaryContact) {
    return (
      <p className="text-muted-foreground border-muted-foreground/30 mb-3 rounded-md border border-dashed p-3 text-sm">
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
      type: taskType || null,
      sales_id: typeof identity?.id === "number" ? identity.id : undefined,
    });
  };

  return (
    <div className="mb-4 space-y-2 rounded-md border border-dashed p-3">
      <Label htmlFor="quick-task-text" className="text-sm">
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
          <Label htmlFor="quick-task-type" className="text-sm">
            {translate("resources.tasks.fields.type", { _: "Type" })}
          </Label>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger id="quick-task-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="quick-task-date" className="text-sm">
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
            <Icon icon={Loader2} size="sm" className="mr-2 animate-spin" />
          ) : (
            <Icon icon={CalendarPlus} size="sm" className="mr-1" />
          )}
          {translate("lago.customer.quick_task.submit")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-destructive text-sm">
          {translate("lago.customer.quick_task.save_failed")}
        </p>
      )}
    </div>
  );
}
