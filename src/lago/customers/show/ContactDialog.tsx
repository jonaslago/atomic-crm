import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetIdentity } from "ra-core";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { useInvalidateAfterWrite } from "@/lago/registrer/mutations";

/**
 * Brief 46 §2 (16. sep 2026) · Én kontaktdialog, tre indgange.
 *
 * Kontakter er CRM-ejede (VISMA har kun firmaet). Derfor må sælger og
 * kontor redigere direkte — ingen forslags-mellemled. Dialogen bruges
 * fra ContactsCard ("Tilføj"), fra kontakt-rækker ("Redigér"), og
 * senere fra RegistrerModal ("Hvem?"-inline).
 *
 * Felter er de mindst mulige der gør en kontakt brugbar i felten:
 * fornavn (påkrævet), efternavn, titel, telefon, mobil, e-mail, noter.
 * Én telefon + én mobil → phone_jsonb med type=Work/Mobile; én e-mail
 * → email_jsonb med type=Work. Vil man senere have flere numre eller
 * addresser går man ind på selve kontaktkortet.
 */

type Mode = "create" | "edit";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: number;
  companyName?: string;
  /** Sat = redigér eksisterende. Uden = opret ny. */
  contactId?: number | null;
  /** Hvis sat, prøves brugt som fornavn på create — praktisk fra
   *  RegistrerModal hvor sælger har skrevet et navn i "Hvem?"-feltet. */
  initialName?: string;
  onCreated?: (contact: { id: number; fullName: string }) => void;
}

interface ContactFormState {
  first_name: string;
  last_name: string;
  title: string;
  phone_work: string;
  phone_mobile: string;
  email: string;
  background: string;
}

const EMPTY_FORM: ContactFormState = {
  first_name: "",
  last_name: "",
  title: "",
  phone_work: "",
  phone_mobile: "",
  email: "",
  background: "",
};

interface RawContactRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email_jsonb: Array<{ email: string; type?: string }> | null;
  phone_jsonb: Array<{ number: string; type?: string }> | null;
  background: string | null;
}

async function fetchContactFullRow(id: number): Promise<RawContactRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, title, email_jsonb, phone_jsonb, background")
    .eq("id", id)
    .maybeSingle<RawContactRow>();
  if (error) throw error;
  return data;
}

function toForm(row: RawContactRow | null): ContactFormState {
  if (!row) return EMPTY_FORM;
  const emails = row.email_jsonb ?? [];
  const phones = row.phone_jsonb ?? [];
  const emailWork = emails.find((e) => e.type === "Work")?.email ?? emails[0]?.email ?? "";
  const phoneWork = phones.find((p) => p.type === "Work")?.number ?? "";
  const phoneMobile =
    phones.find((p) => p.type === "Mobile" || p.type === "Home")?.number ?? "";
  return {
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    title: row.title ?? "",
    phone_work: phoneWork,
    phone_mobile: phoneMobile,
    email: emailWork,
    background: row.background ?? "",
  };
}

export function ContactDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  contactId,
  initialName,
  onCreated,
}: ContactDialogProps) {
  const mode: Mode = contactId != null ? "edit" : "create";
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;
  const qc = useQueryClient();
  const invalidate = useInvalidateAfterWrite();

  const loadQuery = useQuery({
    queryKey: ["lago-contact-full", contactId],
    queryFn: () => fetchContactFullRow(contactId as number),
    enabled: open && mode === "edit" && contactId != null,
    staleTime: 15_000,
  });

  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      setForm(toForm(loadQuery.data ?? null));
    } else {
      const seeded = { ...EMPTY_FORM };
      if (initialName?.trim()) {
        const trimmed = initialName.trim().replace(/\s+/g, " ");
        const lastSpace = trimmed.lastIndexOf(" ");
        if (lastSpace === -1) {
          seeded.first_name = trimmed;
        } else {
          seeded.first_name = trimmed.slice(0, lastSpace);
          seeded.last_name = trimmed.slice(lastSpace + 1);
        }
      }
      setForm(seeded);
    }
  }, [open, mode, loadQuery.data, initialName]);

  const save = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      const first = form.first_name.trim();
      const last = form.last_name.trim() || null;
      if (!first) throw new Error("Fornavn er påkrævet");
      const emailJsonb =
        form.email.trim().length > 0
          ? [{ email: form.email.trim(), type: "Work" as const }]
          : [];
      const phones: Array<{ number: string; type: "Work" | "Mobile" }> = [];
      if (form.phone_work.trim())
        phones.push({ number: form.phone_work.trim(), type: "Work" });
      if (form.phone_mobile.trim())
        phones.push({ number: form.phone_mobile.trim(), type: "Mobile" });
      const payload = {
        first_name: first,
        last_name: last,
        title: form.title.trim() || null,
        email_jsonb: emailJsonb,
        phone_jsonb: phones,
        background: form.background.trim() || null,
      };
      if (mode === "edit" && contactId != null) {
        const { error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", contactId);
        if (error) throw error;
        return { id: contactId, fullName: [first, last].filter(Boolean).join(" ") };
      }
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          ...payload,
          company_id: companyId,
          sales_id: mySalesId,
          first_seen: nowIso,
          last_seen: nowIso,
          tags: [],
        })
        .select("id")
        .single<{ id: number }>();
      if (error) throw error;
      return { id: data.id, fullName: [first, last].filter(Boolean).join(" ") };
    },
    onSuccess: (result) => {
      invalidate(companyId);
      qc.invalidateQueries({ queryKey: ["lago-contact-full", result.id] });
      toast.success(
        mode === "edit"
          ? `Kontakt "${result.fullName}" opdateret`
          : `Kontakt "${result.fullName}" tilføjet${companyName ? ` på ${companyName}` : ""}`,
        { duration: 3500 },
      );
      onCreated?.(result);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(
        mode === "edit"
          ? "Kunne ikke gemme kontakten"
          : "Kunne ikke tilføje kontakten",
        { description: readErrorMessage(err) },
      ),
  });

  const disabled = save.isPending || loadQuery.isFetching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>
            {mode === "edit" ? "Redigér kontakt" : "Tilføj kontakt"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Kontaktoplysninger — Fornavn er påkrævet, resten er valgfrit.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && form.first_name.trim()) save.mutate();
          }}
          className="flex flex-col"
        >
          <div className="grid grid-cols-1 gap-3 px-6 pt-3 pb-4 sm:grid-cols-2">
            <FieldInput
              id="c-first"
              label="Fornavn *"
              value={form.first_name}
              onChange={(v) => setForm({ ...form, first_name: v })}
              autoFocus
            />
            <FieldInput
              id="c-last"
              label="Efternavn"
              value={form.last_name}
              onChange={(v) => setForm({ ...form, last_name: v })}
            />
            <FieldInput
              id="c-title"
              label="Titel"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              className="sm:col-span-2"
            />
            <FieldInput
              id="c-phone"
              label="Telefon"
              value={form.phone_work}
              onChange={(v) => setForm({ ...form, phone_work: v })}
              inputMode="tel"
            />
            <FieldInput
              id="c-mobile"
              label="Mobil"
              value={form.phone_mobile}
              onChange={(v) => setForm({ ...form, phone_mobile: v })}
              inputMode="tel"
            />
            <FieldInput
              id="c-email"
              label="E-mail"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              inputMode="email"
              className="sm:col-span-2"
            />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-notes" className="text-sm">
                Noter <span className="text-[var(--fg-3)]">(valgfri)</span>
              </Label>
              <Textarea
                id="c-notes"
                rows={3}
                value={form.background}
                onChange={(e) => setForm({ ...form, background: e.target.value })}
                className="text-sm"
              />
            </div>
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
              disabled={disabled || !form.first_name.trim()}
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

function FieldInput({
  id,
  label,
  value,
  onChange,
  className,
  inputMode,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  inputMode?: "tel" | "email";
  autoFocus?: boolean;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="min-h-11 w-full min-w-0 text-sm"
      />
    </div>
  );
}
