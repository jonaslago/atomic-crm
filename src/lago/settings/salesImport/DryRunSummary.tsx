import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Icon } from "@/lago/ui/Icon";
import type { DryRunResult } from "./types";

const kr = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const int = new Intl.NumberFormat("da-DK");

export function DryRunSummary({ result }: { result: DryRunResult<unknown> }) {
  if (result.headerError) {
    return (
      <div className="border-[var(--st-red-fg)]/30 bg-[var(--st-red-bg)] text-[var(--st-red-fg)] rounded-md border p-4">
        <div className="mb-2 flex items-center gap-2 font-bold">
          <Icon icon={AlertCircle} size="sm" />
          <span>Manglende kolonner i filen</span>
        </div>
        <ul className="mb-3 ml-6 list-disc text-sm">
          {result.headerError.missingColumns.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {result.headerError.foundHeaders.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-bold">
              Kolonner filen faktisk indeholder ({result.headerError.foundHeaders.length})
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-white/60 p-2 font-mono text-xs">
              {result.headerError.foundHeaders.join(" · ")}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rækker i fil" value={int.format(result.rowsInFile)} />
        <Stat
          label="Rækker efter filter"
          value={int.format(result.rowsAfterFilter)}
        />
        {result.matchedCustomers != null && (
          <Stat
            label="Kunder genkendt"
            value={int.format(result.matchedCustomers)}
          />
        )}
        {result.totalBelob != null && (
          <Stat label="Total beløb" value={kr.format(result.totalBelob)} />
        )}
      </div>

      {result.periodTotals && result.periodTotals.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wide">
            Totaler pr. periode
          </h5>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Periode</th>
                  <th className="px-3 py-2 text-right tabular-nums">Beløb</th>
                </tr>
              </thead>
              <tbody>
                {result.periodTotals.map((p) => (
                  <tr key={p.label} className="border-t">
                    <td className="px-3 py-1.5">{p.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {kr.format(p.belob)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.categoryBreakdown && result.categoryBreakdown.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wide">
            Fordeling
          </h5>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Kategori</th>
                  <th className="px-3 py-2 text-right tabular-nums">Rækker</th>
                  <th className="px-3 py-2 text-right tabular-nums">Beløb</th>
                </tr>
              </thead>
              <tbody>
                {result.categoryBreakdown.map((c) => (
                  <tr key={c.label} className="border-t">
                    <td className="px-3 py-1.5">{c.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {int.format(c.rows)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {c.belob !== 0 ? kr.format(c.belob) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.unknownCustomers && result.unknownCustomers.length > 0 && (
        <details className="text-sm">
          <summary className="text-[var(--st-amber-fg)] cursor-pointer font-bold">
            {result.unknownCustomers.length} ukendte kundenumre — vises, ikke afvist
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto rounded border p-2 font-mono text-xs">
            {result.unknownCustomers.join(" · ")}
          </div>
        </details>
      )}

      {result.rowErrors.length > 0 && (
        <details className="text-sm">
          <summary className="text-[var(--st-amber-fg)] cursor-pointer font-bold">
            {result.rowErrors.length} advarsler under parsing
          </summary>
          <ul className="mt-2 max-h-40 overflow-y-auto ml-6 list-disc">
            {result.rowErrors.slice(0, 100).map((e, i) => (
              <li key={i}>
                Række {e.rowIndex}: {e.message}
              </li>
            ))}
            {result.rowErrors.length > 100 && (
              <li>… og {result.rowErrors.length - 100} flere</li>
            )}
          </ul>
        </details>
      )}

      {result.ok && (
        <div className="text-[var(--st-green-fg)] flex items-center gap-2 text-sm font-bold">
          <Icon icon={CheckCircle2} size="sm" />
          Tørløb OK — klar til import
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
