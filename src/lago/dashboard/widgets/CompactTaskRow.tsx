import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

import { Meta } from "@/lago/ui/Meta";

/**
 * §31c (1. okt 2026): compact task row shared across four places —
 * sælger dashboard, kontor's two widgets, customer card.
 *
 * Collapsed — one line:
 *   left:   customer name · task text (truncated)
 *   middle: "Fra Peter · 24. sep" as Meta
 *   right:  due date, red when overdue
 *
 * Expanded — on row click:
 *   Full task text, customer with city+seller, origin, actions.
 *
 * Actions live inside the expanded row, not in the collapsed one.
 * Twenty tasks = twenty lines, not a hundred.
 */

export interface CompactTaskRowProps {
  id: number;
  text: string;
  companyName: string | null;
  companyId: number | null;
  dueDate: string | null;
  origin: string | null;
  /** Hide customer name (e.g. on the customer card). */
  hideCompany?: boolean;
  /** Actions rendered inside the expanded state. */
  actions?: React.ReactNode;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
});

function dueLabel(iso: string | null): {
  text: string;
  isOverdue: boolean;
  noDueDate: boolean;
} {
  // §31c (1. okt 2026): tasks without due_date show "Ingen frist" —
  // they are more exposed than dated ones because nobody gets reminded.
  if (!iso) return { text: "Ingen frist", isOverdue: false, noDueDate: true };
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due < today)
    return { text: dateFmt.format(due), isOverdue: true, noDueDate: false };
  if (due < tomorrow)
    return { text: "I dag", isOverdue: false, noDueDate: false };
  return { text: dateFmt.format(due), isOverdue: false, noDueDate: false };
}

export function CompactTaskRow({
  text,
  companyName,
  companyId,
  dueDate,
  origin,
  hideCompany,
  actions,
}: CompactTaskRowProps) {
  const [open, setOpen] = useState(false);
  const due = dueLabel(dueDate);
  const displayName = hideCompany ? null : companyName;

  return (
    <div className="border-b border-[var(--line)] last:border-b-0">
      {/* Collapsed: one line */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-11 items-center gap-3 px-1 py-2 text-left hover:bg-[var(--surface-1)] rounded-md"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
          {displayName && <span className="font-medium">{displayName} · </span>}
          <span className={displayName ? "" : "font-medium"}>{text}</span>
        </span>
        {origin && <Meta className="hidden md:inline shrink-0">{origin}</Meta>}
        <span
          className={cn(
            "shrink-0 text-[length:var(--t-meta)] tabular-nums font-medium",
            due.isOverdue ? "text-[var(--st-red-fg)]" : "text-[var(--fg-3)]",
          )}
        >
          {due.text}
        </span>
      </button>

      {/* Expanded: full content + actions */}
      {open && (
        <div className="px-1 pb-3 pt-1">
          {/* Full task text */}
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--fg)]">
            {text}
          </p>
          {/* Customer link */}
          {companyName && companyId && (
            <Link
              to={`/companies/${companyId}/show`}
              className="mt-1 block text-[length:var(--t-meta)] font-medium text-[var(--fg-2)] no-underline hover:underline"
            >
              {companyName}
            </Link>
          )}
          {/* Origin + due date as Meta */}
          <div className="mt-1 flex items-center gap-2 text-[length:var(--t-meta)] text-[var(--fg-3)]">
            {origin && <span>{origin}</span>}
            {origin && <span>·</span>}
            <span
              className={due.isOverdue ? "text-[var(--st-red-fg)]" : undefined}
            >
              {due.noDueDate
                ? "Ingen frist"
                : due.isOverdue
                  ? `Forfaldt ${due.text}`
                  : `Forfalder ${due.text}`}
            </span>
          </div>
          {/* Actions */}
          {actions && (
            <div className="mt-3 flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}
    </div>
  );
}
