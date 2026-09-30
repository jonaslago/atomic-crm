import { CheckboxRow, FilterGroup, RadioRow } from "@/lago/ui/FilterPrimitives";
import { useBrancher } from "@/lago/settings/useBrancher";

import type { ContactListRow } from "./dataAccess";

/**
 * Brief 60 §1 (+ rettelse 17. sep 2026) · Filterskinne — kontekst-følsomme tal.
 *
 * Tallene i hver gruppe beregnes med alle ANDRE gruppers filtre anvendt,
 * men uden gruppens EGET filter. Det gør dem brugbare igen: står der
 * "Vest 12" ved siden af et allerede valgt segment, betyder tallet
 * "hvis jeg også vælger Vest, får jeg 12 kontakter". Rene absolutte tal
 * (fx "Vest 104" mens Segment X er valgt og resultatet er 5) er værre
 * end intet tal — de lyver om, hvad næste klik vil give.
 *
 * Samme regel gælder kundelistens skinne — den skal have samme rettelse
 * (fixes særskilt).
 */

const UDEN_BRANCHE = -1 as const;
type BrancheKey = number | typeof UDEN_BRANCHE;

export interface ContactFiltersState {
  segment: "A" | "B" | "C" | "X" | "L" | "all";
  distrikter: Set<string>;
  brancheKoder: Set<BrancheKey>;
  salesCodes: Set<string>;
}

export const EMPTY_FILTERS: ContactFiltersState = {
  segment: "all",
  distrikter: new Set(),
  brancheKoder: new Set(),
  salesCodes: new Set(),
};

interface Props {
  rows: ContactListRow[];
  value: ContactFiltersState;
  search: string;
  onChange: (next: ContactFiltersState) => void;
}

function countActive(f: ContactFiltersState): number {
  let n = 0;
  if (f.segment !== "all") n++;
  if (f.distrikter.size > 0) n++;
  if (f.brancheKoder.size > 0) n++;
  if (f.salesCodes.size > 0) n++;
  return n;
}

export function LagoContactFilters({ rows, value, search, onChange }: Props) {
  const brancher = useBrancher();
  const activeCount = countActive(value);

  // Fire subsets — en pr. gruppe hvor gruppens eget filter er nul.
  // Alle andre filtre + søgning anvendes normalt. Rows er op til ~500,
  // så fire O(N) filtreringer er billig.
  const subsetForSegment = applyContactFilters(
    rows,
    { ...value, segment: "all" },
    search,
  );
  const subsetForDistrikt = applyContactFilters(
    rows,
    { ...value, distrikter: new Set() },
    search,
  );
  const subsetForBranche = applyContactFilters(
    rows,
    { ...value, brancheKoder: new Set() },
    search,
  );
  const subsetForSales = applyContactFilters(
    rows,
    { ...value, salesCodes: new Set() },
    search,
  );

  // Segment-optioner — "Alle segmenter" = hele subset, hver konkret
  // værdi = tælles i subset.
  const segmentCounts: Record<string, number> = {
    all: subsetForSegment.length,
    A: 0,
    B: 0,
    C: 0,
    X: 0,
    L: 0,
  };
  for (const r of subsetForSegment) {
    const s = r.extension.segment;
    if (s) segmentCounts[s] = (segmentCounts[s] ?? 0) + 1;
  }
  const segmentsPresent: Array<"A" | "B" | "C" | "X" | "L"> = (
    ["A", "B", "C", "X", "L"] as const
  ).filter((s) => (segmentCounts[s] ?? 0) > 0 || value.segment === s);

  // Distrikt-optioner — kun de værdier der forekommer i det bredere
  // dataset (ikke bare i subset), så et distrikt ikke forsvinder helt
  // fordi det pt. er tomt under andre filtre. Tallet henter vi fra
  // subset (0 hvis pt. tomt).
  const distriktValues = new Set<string>();
  for (const r of rows) {
    if (r.extension.distrikt) distriktValues.add(r.extension.distrikt);
  }
  const distriktCountsInSubset = new Map<string, number>();
  for (const r of subsetForDistrikt) {
    const d = r.extension.distrikt;
    if (d) {
      distriktCountsInSubset.set(d, (distriktCountsInSubset.get(d) ?? 0) + 1);
    }
  }
  const distrikter = Array.from(distriktValues)
    .sort((a, b) => a.localeCompare(b, "da"))
    .map(
      (name) =>
        [name, distriktCountsInSubset.get(name) ?? 0] as [string, number],
    );

  // Branche — samme mønster. Udgåede koder (brancher_lago.aktiv=false)
  // lægges nederst uanset navn: de er et fund, ikke et valg.
  const brancheValuesPresent = new Set<number>();
  let utenBrancheEverPresent = false;
  for (const r of rows) {
    const k = r.extension.branche_kode;
    if (k == null) utenBrancheEverPresent = true;
    else brancheValuesPresent.add(k);
  }
  const brancheCountsInSubset = new Map<number, number>();
  let utenBrancheCountInSubset = 0;
  for (const r of subsetForBranche) {
    const k = r.extension.branche_kode;
    if (k == null) utenBrancheCountInSubset++;
    else brancheCountsInSubset.set(k, (brancheCountsInSubset.get(k) ?? 0) + 1);
  }
  const brancherSorted = Array.from(brancheValuesPresent).sort((a, b) => {
    const ba = brancher.byKode(a);
    const bb = brancher.byKode(b);
    // Aktive først, udgåede nederst.
    const activeA = ba?.aktiv ? 0 : 1;
    const activeB = bb?.aktiv ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB;
    const na = ba?.navn ?? String(a);
    const nb = bb?.navn ?? String(b);
    return na.localeCompare(nb, "da");
  });

  // Sælger-optioner — samme mønster. Navnene tager vi fra rows (fuld
  // scope) så en sælger ikke forsvinder pga. andre filtre.
  const salesNames = new Map<string, string>();
  for (const r of rows) {
    const code = r.extension.visma_sales_code;
    const name = r.extension.visma_sales_name;
    if (code && name && !salesNames.has(code)) salesNames.set(code, name);
  }
  const salesCountsInSubset = new Map<string, number>();
  for (const r of subsetForSales) {
    const code = r.extension.visma_sales_code;
    if (code) {
      salesCountsInSubset.set(code, (salesCountsInSubset.get(code) ?? 0) + 1);
    }
  }
  const salesSorted = Array.from(salesNames.entries()).sort((a, b) =>
    a[1].localeCompare(b[1], "da"),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--fg)]">Filtrering</h3>
        {activeCount > 0 && (
          <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
            {activeCount} aktive
          </span>
        )}
      </div>

      <FilterGroup label="Segment">
        <RadioRow
          name="c-segment"
          value="all"
          label="Alle segmenter"
          selected={value.segment}
          onSelect={(v) =>
            onChange({ ...value, segment: v as ContactFiltersState["segment"] })
          }
          count={segmentCounts.all ?? 0}
        />
        {segmentsPresent.map((s) => (
          <RadioRow
            key={s}
            name="c-segment"
            value={s}
            label={`Segment ${s}`}
            selected={value.segment}
            onSelect={(v) =>
              onChange({
                ...value,
                segment: v as ContactFiltersState["segment"],
              })
            }
            count={segmentCounts[s] ?? 0}
          />
        ))}
      </FilterGroup>

      {distrikter.length > 0 && (
        <FilterGroup label="Distrikt">
          {distrikter.map(([name, count]) => (
            <CheckboxRow
              key={name}
              label={name}
              checked={value.distrikter.has(name)}
              onChange={() => {
                const next = new Set(value.distrikter);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                onChange({ ...value, distrikter: next });
              }}
              count={count}
            />
          ))}
        </FilterGroup>
      )}

      {(brancherSorted.length > 0 || utenBrancheEverPresent) && (
        <FilterGroup label="Branche">
          {brancherSorted.map((kode) => {
            const b = brancher.byKode(kode);
            const label = b?.navn ?? `Kode ${kode}`;
            const count = brancheCountsInSubset.get(kode) ?? 0;
            return (
              <CheckboxRow
                key={kode}
                label={label}
                checked={value.brancheKoder.has(kode)}
                onChange={() => toggleBranche(kode, value, onChange)}
                count={count}
              />
            );
          })}
          {utenBrancheEverPresent && (
            <CheckboxRow
              label="Uden branche"
              checked={value.brancheKoder.has(UDEN_BRANCHE)}
              onChange={() => toggleBranche(UDEN_BRANCHE, value, onChange)}
              count={utenBrancheCountInSubset}
            />
          )}
        </FilterGroup>
      )}

      {salesSorted.length > 0 && (
        <FilterGroup label="Ansvarlig sælger">
          {salesSorted.map(([code, name]) => (
            <CheckboxRow
              key={code}
              label={name}
              checked={value.salesCodes.has(code)}
              onChange={() => {
                const next = new Set(value.salesCodes);
                if (next.has(code)) next.delete(code);
                else next.add(code);
                onChange({ ...value, salesCodes: next });
              }}
              count={salesCountsInSubset.get(code) ?? 0}
            />
          ))}
        </FilterGroup>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="mt-2 self-center text-[length:var(--t-sec)] text-[var(--fg-2)] underline underline-offset-2 hover:text-[var(--fg)]"
        >
          Nulstil alle filtre
        </button>
      )}
    </div>
  );
}

function toggleBranche(
  key: BrancheKey,
  value: ContactFiltersState,
  onChange: (next: ContactFiltersState) => void,
) {
  const next = new Set(value.brancheKoder);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  onChange({ ...value, brancheKoder: next });
}

/**
 * Anvender aktive filtre plus søge-strengen. Søgning matcher navn, titel,
 * kundenavn og telefon (VISMA-fri format-uafhængig sammenligning).
 */
export function applyContactFilters(
  rows: ContactListRow[],
  f: ContactFiltersState,
  search: string,
): ContactListRow[] {
  const q = search.trim().toLowerCase();
  const digitsQ = q.replace(/\D/g, "");
  return rows.filter((r) => {
    if (f.segment !== "all" && r.extension.segment !== f.segment) return false;
    if (f.distrikter.size > 0) {
      const d = r.extension.distrikt;
      if (!d || !f.distrikter.has(d)) return false;
    }
    if (f.brancheKoder.size > 0) {
      const k = r.extension.branche_kode;
      const matchesNone = k == null && f.brancheKoder.has(UDEN_BRANCHE);
      const matchesKode = k != null && f.brancheKoder.has(k);
      if (!matchesNone && !matchesKode) return false;
    }
    if (f.salesCodes.size > 0) {
      const c = r.extension.visma_sales_code;
      if (!c || !f.salesCodes.has(c)) return false;
    }
    if (q) {
      const first = (r.first_name ?? "").toLowerCase();
      const last = (r.last_name ?? "").toLowerCase();
      const title = (r.title ?? "").toLowerCase();
      const cname = r.company.name.toLowerCase();
      const nameHit =
        first.includes(q) ||
        last.includes(q) ||
        `${first} ${last}`.includes(q) ||
        title.includes(q) ||
        cname.includes(q);
      let phoneHit = false;
      if (digitsQ.length >= 3 && r.phone_jsonb) {
        for (const p of r.phone_jsonb) {
          const d = (p.number ?? "").replace(/\D/g, "");
          if (d.includes(digitsQ)) {
            phoneHit = true;
            break;
          }
        }
      }
      if (!nameHit && !phoneHit) return false;
    }
    return true;
  });
}

// -------------------------------------------------------------------
// Sortering — brief 60 §2.
// -------------------------------------------------------------------

export type ContactSortMode = "last_name" | "first_name" | "customer";

export const DEFAULT_SORT: ContactSortMode = "last_name";

export const SORT_LABELS: Record<ContactSortMode, string> = {
  last_name: "Efternavn (A–Å)",
  first_name: "Fornavn (A–Å)",
  customer: "Kunde (A–Å)",
};

const collator = new Intl.Collator("da", { sensitivity: "base" });

/**
 * Sorterer stabilt efter valgt nøgle. Kontakter uden efternavn sorteres
 * på fornavn (i last_name-mode) så "Claus #2" ikke lander som blindgyde
 * i toppen fordi han ingen efternavn har.
 */
export function sortContacts(
  rows: ContactListRow[],
  mode: ContactSortMode,
): ContactListRow[] {
  const keyFn = (r: ContactListRow) => {
    if (mode === "customer") {
      return r.company.name || "";
    }
    if (mode === "first_name") {
      return (r.first_name ?? r.last_name ?? "").trim();
    }
    const last = (r.last_name ?? "").trim();
    if (last) return last;
    return (r.first_name ?? "").trim();
  };
  const withKeys = rows.map((r, i) => ({ r, k: keyFn(r), i }));
  withKeys.sort((a, b) => {
    const cmp = collator.compare(a.k, b.k);
    if (cmp !== 0) return cmp;
    return a.i - b.i;
  });
  return withKeys.map((x) => x.r);
}
