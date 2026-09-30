import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Phone, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icon } from "@/lago/ui/Icon";
import { formatPhonePairs } from "@/lago/ui/formatPhone";
import { getAppVersion } from "@/lago/layout/useAppVersion";

import {
  fetchContactList,
  formatContactName,
  primaryEmail,
  primaryPhone,
  type ContactListRow,
} from "./dataAccess";
import {
  applyContactFilters,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  LagoContactFilters,
  SORT_LABELS,
  sortContacts,
  type ContactFiltersState,
  type ContactSortMode,
} from "./LagoContactFilters";
import { CreateContactButton } from "./CreateContactButton";
import { ContactPreviewPanel } from "./ContactPreviewPanel";
import { LagoPullToRefresh } from "@/lago/ui/PullToRefresh";

/**
 * Brief 56 · Kontaktpersoner-siden. Brief 60 §1+§2: filtre er
 * checkboxes/radios med tal (som kundelisten), sortering står i URL'en.
 */
export function LagoContactList() {
  const [filters, setFilters] = useState<ContactFiltersState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Brief 60 §2: sortering står i adressen så et link viser samme
  // rækkefølge som afsenderen så — samme regel som kundelisten
  // (?sort=priority) og brief 44 §3.
  const [searchParams, setSearchParams] = useSearchParams();
  const sortFromUrl = searchParams.get("sort");
  const sortMode: ContactSortMode =
    sortFromUrl === "first_name" || sortFromUrl === "customer"
      ? sortFromUrl
      : DEFAULT_SORT;
  const setSortMode = (v: ContactSortMode) => {
    const next = new URLSearchParams(searchParams);
    if (v === DEFAULT_SORT) next.delete("sort");
    else next.set("sort", v);
    setSearchParams(next, { replace: true });
  };

  const query = useQuery({
    queryKey: ["lago-contact-list"],
    queryFn: fetchContactList,
    staleTime: 60_000,
  });

  const allRows = query.data ?? [];
  const filteredRows = useMemo(
    () => applyContactFilters(allRows, filters, search),
    [allRows, filters, search],
  );
  const displayRows = useMemo(
    () => sortContacts(filteredRows, sortMode),
    [filteredRows, sortMode],
  );

  const totalCount = allRows.length;
  const shownCount = displayRows.length;
  const selectedRow = useMemo(
    () => (selectedId != null ? allRows.find((r) => r.id === selectedId) ?? null : null),
    [allRows, selectedId],
  );
  const openPreview = (id: number) => {
    setSelectedId(id);
    setPreviewOpen(true);
  };

  return (
    <LagoPullToRefresh>
    <div className="mx-auto max-w-screen-2xl px-4 pt-4 pb-8">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--fg)]">
            Kontaktpersoner
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-2)]">
            {query.isPending
              ? "Henter…"
              : totalCount === 0
                ? "Ingen kontakter registreret."
                : shownCount === totalCount
                  ? `Viser ${totalCount} kontaktpersoner`
                  : `Viser ${shownCount} af ${totalCount} kontaktpersoner`}
          </p>
        </div>
        <CreateContactButton />
      </header>

      {query.error && (
        <ErrorPanel message="Kunne ikke hente kontaktpersonerne. Prøv at genindlæse." />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="hidden lg:block lg:w-[240px] lg:shrink-0">
          <LagoContactFilters
            rows={allRows}
            value={filters}
            search={search}
            onChange={setFilters}
          />
        </aside>

        <section className="min-w-0 flex-1">
          {/* Søge- + sortering- + mobil-filter-bjælke, klæber i skærmkanten. */}
          {/* Brief 58 §2d (17. sep 2026): baggrunden må ikke tabes ved
              lg+. `lg:bg-transparent`/`lg:border-none` gjorde tidligere
              at rækkerne kunne læses igennem søgebjælken når man
              rullede. Én linje høj, bruges hele tiden — den klæber
              også på store bredder (brief 55 §1 for kontakter). */}
          <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 lg:-mx-0">
            <div className="relative min-w-0 flex-1">
              <Icon
                icon={Search}
                size="sm"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-3)]"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg på navn, titel, kunde eller telefon…"
                className="min-h-11 w-full pl-9 text-sm"
                inputMode="search"
              />
            </div>
            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode(v as ContactSortMode)}
            >
              <SelectTrigger className="hidden shrink-0 md:flex md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as ContactSortMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {SORT_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--r-2)] border border-[var(--line)] bg-[var(--surface-1)] px-3 text-sm text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] lg:hidden"
                >
                  <Icon icon={SlidersHorizontal} size="sm" />
                  Tilpas
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm">
                <SheetHeader>
                  <SheetTitle>Filtrering og sortering</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col gap-6">
                  <div>
                    <p className="mb-2 text-[length:var(--t-meta)] font-medium uppercase tracking-wider text-[var(--fg-3)]">
                      Sortering
                    </p>
                    <Select
                      value={sortMode}
                      onValueChange={(v) => setSortMode(v as ContactSortMode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SORT_LABELS) as ContactSortMode[]).map(
                          (m) => (
                            <SelectItem key={m} value={m}>
                              {SORT_LABELS[m]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <LagoContactFilters
                    rows={allRows}
                    value={filters}
                    search={search}
                    onChange={setFilters}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Tabel — PC/tablet fra sm-og-op. */}
          <div className="hidden sm:block">
            {query.isPending ? (
              <div className="py-10 text-sm text-[var(--fg-2)]">
                Henter kontakter…
              </div>
            ) : displayRows.length === 0 && totalCount > 0 ? (
              <div className="py-10 text-sm text-[var(--fg-2)]">
                Ingen kontakter matcher filtrene.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-1)] text-left text-[12px] font-medium uppercase tracking-wide text-[var(--fg-2)]">
                    <tr>
                      <th className="px-3 py-3">Navn</th>
                      <th className="px-3 py-3">Titel</th>
                      <th className="px-3 py-3">Kunde</th>
                      <th className="px-3 py-3">Telefon</th>
                      <th className="px-3 py-3">E-mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((r, i) => (
                      <ContactTableRow
                        key={r.id}
                        row={r}
                        isLast={i === displayRows.length - 1}
                        selected={r.id === selectedId && previewOpen}
                        onSelect={() => openPreview(r.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobilkort — under sm. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {query.isPending ? (
              <li className="py-6 text-sm text-[var(--fg-2)]">
                Henter kontakter…
              </li>
            ) : displayRows.length === 0 && totalCount > 0 ? (
              <li className="py-6 text-sm text-[var(--fg-2)]">
                Ingen kontakter matcher filtrene.
              </li>
            ) : (
              displayRows.map((r) => (
                <li key={r.id}>
                  <ContactMobileCard
                    row={r}
                    onSelect={() => openPreview(r.id)}
                  />
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <ContactPreviewPanel
        row={selectedRow}
        open={previewOpen}
        onOpenChange={(v) => {
          setPreviewOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </div>
    </LagoPullToRefresh>
  );
}

function ContactTableRow({
  row,
  isLast,
  selected,
  onSelect,
}: {
  row: ContactListRow;
  isLast: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = formatContactName(row.first_name, row.last_name);
  const email = primaryEmail(row.email_jsonb);
  const phone = primaryPhone(row.phone_jsonb);
  const city = row.company.city;
  const rowCls = isLast ? "" : "border-b border-[var(--line)]";
  const selectedCls = selected ? "bg-[var(--surface-1)]" : "hover:bg-[var(--surface-1)]/50";
  const stopEvent = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <tr
      className={`${rowCls} h-11 cursor-pointer align-middle ${selectedCls}`}
      onClick={onSelect}
    >
      <td className="max-w-[220px] truncate px-3 py-2">
        <div className="truncate text-sm font-bold text-[var(--fg)]">
          {name || "—"}
        </div>
        {city && (
          <div className="truncate text-[13px] text-[var(--fg-3)]">
            {city}
          </div>
        )}
      </td>
      <td className="max-w-[180px] truncate px-3 py-2 text-[var(--fg-2)]">
        {row.title || "—"}
      </td>
      <td className="max-w-[220px] truncate px-3 py-2">
        <Link
          to={`/companies/${row.company.id}/show`}
          onClick={stopEvent}
          className="truncate text-[var(--fg)] no-underline hover:underline"
        >
          {row.company.name}
        </Link>
      </td>
      <td className="max-w-[140px] truncate px-3 py-2 tabular-nums">
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            onClick={stopEvent}
            className="text-[var(--fg)] no-underline hover:underline"
          >
            {formatPhonePairs(phone)}
          </a>
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        )}
      </td>
      <td className="max-w-[220px] truncate px-3 py-2">
        {email ? (
          <a
            onClick={stopEvent}
            href={`mailto:${email}`}
            className="truncate text-[var(--fg)] no-underline hover:underline"
          >
            {email}
          </a>
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        )}
      </td>
    </tr>
  );
}

function ContactMobileCard({
  row,
  onSelect,
}: {
  row: ContactListRow;
  onSelect: () => void;
}) {
  const name = formatContactName(row.first_name, row.last_name);
  const phone = primaryPhone(row.phone_jsonb);
  const stopEvent = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <article
      className="flex cursor-pointer items-start justify-between gap-3 rounded-lg bg-[var(--surface-1)] p-4"
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold text-[var(--fg)]">
          {name || "—"}
        </div>
        <div className="truncate text-sm text-[var(--fg-2)]">
          {row.title ? `${row.title} · ` : ""}
          <Link
            to={`/companies/${row.company.id}/show`}
            onClick={stopEvent}
            className="text-[var(--fg)] no-underline hover:underline"
          >
            {row.company.name}
          </Link>
        </div>
        {phone && (
          <div className="mt-1 text-[13px] tabular-nums text-[var(--fg-2)]">
            {formatPhonePairs(phone)}
          </div>
        )}
      </div>
      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          onClick={stopEvent}
          aria-label={`Ring til ${name || "kontakt"}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--r-2)] bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
        >
          <Icon icon={Phone} size="sm" />
        </a>
      )}
    </article>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--st-red-fg)]/40 bg-[var(--st-red-bg)] px-4 py-3 text-sm">
      <Icon
        icon={AlertCircle}
        size="sm"
        className="mt-0.5 text-[var(--st-red-fg)]"
      />
      <div className="text-[var(--fg-2)]">
        {message}
        <div className="mt-0.5 font-mono text-[length:var(--t-meta)] text-[var(--fg-3)]">
          Version: {getAppVersion()}
        </div>
      </div>
    </div>
  );
}
