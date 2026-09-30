import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";
import { updateNote } from "@/lago/customers/dataAccess";

/**
 * Sletteregler (29. sep 2026) · Redigér note.
 *
 * Modstykke til EditActivityDialog, men enklere: en note er kun tekst.
 * Ingen dato, ingen type. Reglen ejer/admin håndhæves i kald-stedet
 * (canEditNote), ikke i dialogen selv.
 */

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: number;
  companyId: number;
  initialText: string;
}

export function EditNoteDialog({
  open,
  onOpenChange,
  noteId,
  companyId,
  initialText,
}: EditNoteDialogProps) {
  const invalidate = useInvalidateAfterWrite();
  const qc = useQueryClient();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
  }, [open, initialText]);

  const save = useMutation({
    mutationFn: () => updateNote(noteId, text.trim()),
    onSuccess: () => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-customer", companyId] });
      toast.success("Note rettet");
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Kunne ikke gemme noten", {
        description: readErrorMessage(err),
      }),
  });

  const handleGem = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!text.trim()) return;
    if (text.trim() === initialText.trim()) {
      onOpenChange(false);
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Redigér note</DialogTitle>
          <DialogDescription className="sr-only">
            Rediger notens tekst. Ændringen gemmes på selve noten uden
            versionshistorik.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGem} className="flex flex-col">
          <div className="space-y-3 px-6 pt-3 pb-4">
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-sm"
              required
            />
          </div>
          <DialogFooter className="flex flex-col-reverse items-center gap-3 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-[var(--fg-2)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
            >
              Annullér
            </button>
            <Button
              type="submit"
              disabled={save.isPending || !text.trim()}
              className="min-w-[120px] gap-2 bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
            >
              {save.isPending && (
                <Icon icon={Loader2} className="animate-spin" />
              )}
              Gem
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
