import { Loader2 } from "lucide-react";
import { useTranslate } from "ra-core";

import { Icon } from "@/lago/ui/Icon";
import {
  formatYtdPeriod,
  useSalesYtd,
  type SalesYtd,
} from "./useSalesYtd";

const kroner = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 1,
});

/**
 * Kompakt version af SalesYtdPanel til CustomerPreview (højre-sidens
 * preview-panel i kundelisten). Genbruger useSalesYtd så beregningen
 * findes ét sted — panel og mini må aldrig drive fra hinanden.
 */
export function SalesYtdMini({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null | undefined;
}) {
  const translate = useTranslate();
  const query = useSalesYtd(vismaCustomerNo);

  if (!vismaCustomerNo) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
        {translate("lago.customer.sales_development.no_visma_no", {
          _: "Kunden har intet VISMA-kundenummer — ingen salgstal.",
        })}
      </div>
    );
  }
  if (query.isPending) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon icon={Loader2} size="sm" className="animate-spin" />
        {translate("lago.customer.sales_development.loading", {
          _: "Henter …",
        })}
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <div className="text-destructive text-sm">
        {translate("lago.customer.sales_development.load_failed", {
          _: "Kunne ikke hente salgstal.",
        })}
      </div>
    );
  }
  return <MiniBody data={query.data} />;
}

function MiniBody({ data }: { data: SalesYtd }) {
  const translate = useTranslate();
  const periode = formatYtdPeriod(data.throughMonth);

  if (data.kind === "no_revenue_ever") {
    return (
      <div className="text-muted-foreground text-sm italic">
        {translate("lago.customer.sales_development.no_revenue_ever", {
          _: "Ingen omsætning registreret.",
        })}
      </div>
    );
  }

  if (data.kind === "new_this_year") {
    return (
      <div className="space-y-1">
        <MiniRow
          label={`ÅTD (${periode})`}
          value={kroner.format(data.ytdThisYear)}
        />
        <div className="text-[var(--a-deep)] text-xs font-bold">
          {translate("lago.customer.sales_development.new_revenue_label", {
            _: "Ny omsætning",
          })}
          <span className="text-muted-foreground ml-1 font-normal">
            (intet i {data.lastYear})
          </span>
        </div>
      </div>
    );
  }

  if (data.kind === "silent_this_year") {
    return (
      <div className="space-y-1">
        <MiniRow label={`ÅTD (${periode})`} value={kroner.format(0)} />
        <div className="text-muted-foreground text-xs italic">
          {translate("lago.customer.sales_development.silent_short", {
            _: `Ingen omsætning i ÅTD hverken i år eller ${data.lastYear}.`,
          })}
        </div>
      </div>
    );
  }

  const growthColor =
    data.growthKr > 0
      ? "text-[var(--st-green-fg)]"
      : data.growthKr < 0
        ? "text-[var(--st-red-fg)]"
        : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <MiniRow
        label={`ÅTD (${periode})`}
        value={kroner.format(data.ytdThisYear)}
      />
      <MiniRow
        label={`ÅTD ${data.lastYear} (${periode})`}
        value={kroner.format(data.ytdLastYear)}
      />
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {translate("lago.customer.sales_development.growth_kr", {
            _: "Vækst",
          })}
        </span>
        <span
          className={`font-mono font-bold tabular-nums ${growthColor}`}
        >
          {kroner.format(data.growthKr)}
          {data.growthPct != null && (
            <span className="text-muted-foreground ml-1 font-normal">
              ({pct.format(data.growthPct)})
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold tabular-nums">{value}</span>
    </div>
  );
}
