import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * §98-5d (2. okt 2026): "Send videre" — choose a queue or a person.
 *
 * The picker shows all active queues first, then all persons with a
 * CRM login. A task sent to a queue gets queue_id set and sales_id=null.
 * A task sent to a person gets sales_id set and queue_id=null.
 */

export interface SendVidereTarget {
  kind: "queue" | "person";
  id: number;
  name: string;
}

interface SendVidereDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskText: string | null;
  onSend: (target: SendVidereTarget) => void;
  sending?: boolean;
}

interface QueueRow {
  id: number;
  name: string;
}

interface PersonRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

async function fetchTargets(): Promise<{
  queues: QueueRow[];
  persons: PersonRow[];
}> {
  const supabase = getSupabaseClient();
  const [qRes, pRes] = await Promise.all([
    supabase
      .from("task_queues_lago")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("sales")
      .select("id, first_name, last_name")
      .not("user_id", "is", null)
      .order("first_name"),
  ]);
  if (qRes.error) throw qRes.error;
  if (pRes.error) throw pRes.error;
  return {
    queues: (qRes.data ?? []) as QueueRow[],
    persons: (pRes.data ?? []) as PersonRow[],
  };
}

export function SendVidereDialog({
  open,
  onOpenChange,
  taskText,
  onSend,
  sending,
}: SendVidereDialogProps) {
  const [selected, setSelected] = useState<string>("");
  const query = useQuery({
    queryKey: ["lago-send-videre-targets"],
    queryFn: fetchTargets,
    enabled: open,
    staleTime: 60_000,
  });

  const targets = query.data;

  const handleSend = () => {
    if (!selected || !targets) return;
    const [kind, idStr] = selected.split(":");
    const id = Number(idStr);
    if (kind === "queue") {
      const q = targets.queues.find((r) => r.id === id);
      if (q) onSend({ kind: "queue", id, name: q.name });
    } else {
      const p = targets.persons.find((r) => r.id === id);
      if (p) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
        onSend({ kind: "person", id, name });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send videre</DialogTitle>
          <DialogDescription>
            {taskText
              ? `"${taskText.length > 60 ? taskText.slice(0, 60) + "…" : taskText}"`
              : "Vælg modtager for opgaven."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Modtager</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Vælg kø eller person" />
              </SelectTrigger>
              <SelectContent>
                {targets?.queues.map((q) => (
                  <SelectItem key={`queue:${q.id}`} value={`queue:${q.id}`}>
                    {q.name} (kø)
                  </SelectItem>
                ))}
                {(targets?.queues.length ?? 0) > 0 &&
                  (targets?.persons.length ?? 0) > 0 && (
                    <div className="my-1 border-t border-[var(--line)]" />
                  )}
                {targets?.persons.map((p) => (
                  <SelectItem key={`person:${p.id}`} value={`person:${p.id}`}>
                    {[p.first_name, p.last_name].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button onClick={handleSend} disabled={!selected || sending}>
            {sending ? "Sender …" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
