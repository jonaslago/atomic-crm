import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Pencil, Phone } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { formatPhonePairs } from "@/lago/ui/formatPhone";
import { ContactDialog } from "@/lago/customers/show/ContactDialog";

import {
  formatContactName,
  primaryEmail,
  primaryPhone,
  type ContactListRow,
} from "./dataAccess";

/**
 * Brief 60 §3 · Preview-panel for en kontakt.
 *
 * Panelet er en Sheet fra højre — samme mønster som et ark på telefonen,
 * og på desktop lægger den sig over listen så man kan lukke og se
 * kolonnen igen. Ingen /#/contacts/:id-rute; kontakter er ikke bundet
 * til en URL, fordi Jonas overvejer at flytte dem i en undermenu senere.
 *
 * "Aftaler og noter med denne person" (ikke "Nævnt i N aktiviteter",
 * som ville love aktiviteter vi ikke har — customer_activities_lago
 * bærer ingen kontakt-kolonne). Data er tasks (contact_id) og
 * contact_notes (contact_id), unioneret og sorteret på dato descending.
 */

interface Props {
  row: ContactListRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface TaskItem {
  kind: "task";
  id: number;
  date: string | null; // ISO date or null
  text: string;
  done: boolean;
  type: string | null;
  sales_name: string | null;
}

interface NoteItem {
  kind: "note";
  id: number;
  date: string; // ISO timestamp
  text: string;
  sales_name: string | null;
}

type HistoryItem = TaskItem | NoteItem;

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "uden dato";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

async function fetchContactHistory(
  contactId: number,
): Promise<HistoryItem[]> {
  const supabase = getSupabaseClient();
  const [tasksRes, notesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, text, due_date, done_date, type, sales:sales_id(first_name, last_name)",
      )
      .eq("contact_id", contactId)
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("contact_notes")
      .select(
        "id, text, date, sales:sales_id(first_name, last_name)",
      )
      .eq("contact_id", contactId)
      .order("date", { ascending: false })
      .limit(50),
  ]);
  if (tasksRes.error) throw tasksRes.error;
  // Note-fejl skal ikke sprænge hele panelet — vi vil hellere vise
  // opgaverne end intet. Console-fejlen kan fanges i devtools.
  if (notesRes.error) {
    // eslint-disable-next-line no-console
    console.error("[ContactPreviewPanel] contact_notes:", notesRes.error);
  }
  const noteRows = notesRes.error ? [] : (notesRes.data ?? []);

  const tasks: TaskItem[] = (tasksRes.data ?? []).map((t: any) => {
    const salesArr = Array.isArray(t.sales) ? t.sales[0] : t.sales;
    const salesName = salesArr
      ? [salesArr.first_name, salesArr.last_name].filter(Boolean).join(" ")
      : null;
    return {
      kind: "task",
      id: t.id,
      date: t.due_date ?? null,
      text: t.text ?? "",
      done: t.done_date != null,
      type: t.type ?? null,
      sales_name: salesName || null,
    };
  });

  const notes: NoteItem[] = noteRows.map((n: any) => {
    const salesArr = Array.isArray(n.sales) ? n.sales[0] : n.sales;
    const salesName = salesArr
      ? [salesArr.first_name, salesArr.last_name].filter(Boolean).join(" ")
      : null;
    return {
      kind: "note",
      id: n.id,
      date: n.date,
      text: n.text ?? "",
      sales_name: salesName || null,
    };
  });

  const all: HistoryItem[] = [...tasks, ...notes];
  all.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da === db) return 0;
    return db.localeCompare(da);
  });
  return all;
}

export function ContactPreviewPanel({ row, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const history = useQuery({
    queryKey: ["lago-contact-history", row?.id],
    queryFn: () => fetchContactHistory(row!.id),
    enabled: open && row != null,
    staleTime: 30_000,
  });

  const name = row ? formatContactName(row.first_name, row.last_name) : "";
  const phone = row ? primaryPhone(row.phone_jsonb) : null;
  const email = row ? primaryEmail(row.email_jsonb) : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-[var(--line)] px-5 py-4">
            <SheetTitle className="text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
              Kontaktperson
            </SheetTitle>
            {row && (
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-[var(--fg)]">
                    {name || "—"}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-[var(--fg-2)]">
                    {row.title ? `${row.title} · ` : ""}
                    <Link
                      to={`/companies/${row.company.id}/show`}
                      onClick={() => onOpenChange(false)}
                      className="text-[var(--fg)] no-underline hover:underline"
                    >
                      {row.company.name}
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </SheetHeader>

          {row && (
            <div className="flex flex-col gap-5 px-5 py-4">
              {/* Kontaktinfo — telefon + e-mail som klikbare links. */}
              <section className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
                <div className="text-[var(--fg-2)]">Telefon</div>
                <div className="tabular-nums">
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="text-[var(--fg)] no-underline hover:underline"
                    >
                      {formatPhonePairs(phone)}
                    </a>
                  ) : (
                    <span className="text-[var(--fg-3)]">—</span>
                  )}
                </div>
                <div className="text-[var(--fg-2)]">E-mail</div>
                <div className="truncate">
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className="truncate text-[var(--fg)] no-underline hover:underline"
                    >
                      {email}
                    </a>
                  ) : (
                    <span className="text-[var(--fg-3)]">—</span>
                  )}
                </div>
              </section>

              {/* Åbn kundekort — primær vej ind til alt om kunden. */}
              <Link
                to={`/companies/${row.company.id}/show`}
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-11 items-center justify-between rounded-[var(--r-2)] bg-[var(--surface-1)] px-4 py-2 text-sm text-[var(--fg)] no-underline hover:bg-[var(--surface-2)]"
              >
                <span>Åbn kundekort · {row.company.name}</span>
                <Icon icon={ArrowRight} size="sm" />
              </Link>

              {/* Baggrund/noter fra ContactDialog — vises hvis skrevet. */}
              {row.title && null /* placeholder */}
              <HistorySection
                loading={history.isPending}
                error={history.error as Error | null}
                items={history.data ?? []}
              />

              {/* Handlings-rækken — Redigér + Ring op. */}
              <div className="flex items-center gap-2 pb-6">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--r-2)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--fg)] hover:bg-[var(--surface-1)]"
                >
                  <Icon icon={Pencil} size="sm" />
                  Redigér kontakt
                </button>
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s+/g, "")}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--r-2)] bg-[var(--ink)] px-4 text-sm font-medium text-white hover:bg-[var(--ink)]/90"
                  >
                    <Icon icon={Phone} size="sm" />
                    Ring op
                  </a>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {row && (
        <ContactDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          companyId={row.company.id}
          companyName={row.company.name}
          contactId={row.id}
        />
      )}
    </>
  );
}

function HistorySection({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: Error | null;
  items: HistoryItem[];
}) {
  const total = items.length;
  const label = useMemo(() => {
    if (loading) return "Aftaler og noter med denne person";
    if (error) return "Aftaler og noter — kunne ikke hentes";
    if (total === 0) return "Aftaler og noter · endnu ingen";
    return `Aftaler og noter med denne person · ${total}`;
  }, [loading, error, total]);
  return (
    <section>
      <h3 className="mb-2 text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
        {label}
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-[var(--fg-2)]">
          <Icon icon={Loader2} size="sm" className="animate-spin" />
          Henter…
        </div>
      ) : error ? (
        <p className="text-sm text-[var(--fg-2)]">
          Kunne ikke hente. Prøv at genindlæse.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-[var(--fg-2)]">
          Der er endnu ikke registreret aftaler eller noter for denne person.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {items.map((it) => (
            <li key={`${it.kind}-${it.id}`} className="py-3 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
                  {it.kind === "task"
                    ? it.type === "follow-up"
                      ? "Opfølgning"
                      : "Opgave"
                    : "Note"}
                  {it.kind === "task" && it.done ? " · afsluttet" : ""}
                </span>
                <span className="tabular-nums text-[13px] text-[var(--fg-3)]">
                  {formatDate(it.date)}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--fg)]">
                {it.text || "—"}
              </p>
              {it.sales_name && (
                <p className="mt-0.5 text-[13px] text-[var(--fg-3)]">
                  {it.sales_name}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
