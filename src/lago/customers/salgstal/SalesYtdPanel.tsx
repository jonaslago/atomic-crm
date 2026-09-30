import { Loader2, TrendingUp } from "lucide-react";
import { useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/lago/ui/Icon";
import { VismaBadge } from "../VismaBadge";
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
 * Domain-brief 28 §1 · salgspanelet på kundekortet. Erstatter det gamle
 * "Afventer VISMA-sync"-placeholder. Fire tal fra sales_monthly_lago —
 * eller en ærlig besked når der ikke er noget at vise.
 *
 * Perioden står altid ved siden af tallet ("ÅTD (jan–sep)"), så en
 * læser ikke tror at det er T12M eller helår.
 */
export function SalesYtdPanel({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null | undefined;
}) {
  const translate = useTranslate();
  const query = useSalesYtd(vismaCustomerNo);

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={TrendingUp} className="text-muted-foreground" />
          {translate("lago.customer.sections.sales_development")}
          <VismaBadge size="xs" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!vismaCustomerNo ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
            {translate("lago.customer.sales_development.no_visma_no", {
              _: "Kunden har intet VISMA-kundenummer — ingen salgstal kan slås op.",
            })}
          </div>
        ) : query.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            {translate("lago.customer.sales_development.loading", {
              _: "Henter salgstal …",
            })}
          </div>
        ) : query.error ? (
          <div className="text-destructive text-sm">
            {translate("lago.customer.sales_development.load_failed", {
              _: "Kunne ikke hente salgstal.",
            })}
          </div>
        ) : query.data ? (
          <SalesYtdBody data={query.data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SalesYtdBody({ data }: { data: SalesYtd }) {
  const translate = useTranslate();
  const periode = formatYtdPeriod(data.throughMonth);

  if (data.kind === "no_revenue_ever") {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
        {translate("lago.customer.sales_development.no_revenue_ever", {
          _: "Ingen omsætning registreret på kunden.",
        })}
      </div>
    );
  }

  if (data.kind === "new_this_year") {
    return (
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCell
            label={`${translate("lago.customer.sales_development.ytd_this_year", { _: "ÅTD i år" })} (${periode})`}
            value={kroner.format(data.ytdThisYear)}
            emphasise
          />
          <div className="rounded-md border border-[var(--a-deep)] bg-[var(--a-tint)] p-3">
            <div className="text-[var(--a-deep)] text-xs font-bold uppercase tracking-wide">
              {translate("lago.customer.sales_development.new_revenue_label", {
                _: "Ny omsætning",
              })}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              {translate("lago.customer.sales_development.new_revenue_hint", {
                _: `Ingen omsætning i samme periode ${data.lastYear}.`,
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.kind === "silent_this_year") {
    return (
      <div className="grid grid-cols-1 gap-3">
        <MetricCell
          label={`${translate("lago.customer.sales_development.ytd_this_year", { _: "ÅTD i år" })} (${periode})`}
          value={kroner.format(0)}
        />
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          {translate("lago.customer.sales_development.silent_this_year", {
            _: `Ingen omsætning i ÅTD hverken i år eller ${data.lastYear}. Kunden har historisk aktivitet før dette vindue.`,
          })}
        </div>
      </div>
    );
  }

  // both_periods
  const growthColor =
    data.growthKr > 0
      ? "text-[var(--st-green-fg)]"
      : data.growthKr < 0
        ? "text-[var(--st-red-fg)]"
        : "text-muted-foreground";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCell
        label={`${translate("lago.customer.sales_development.ytd_this_year", { _: "ÅTD i år" })} (${periode})`}
        value={kroner.format(data.ytdThisYear)}
        emphasise
      />
      <MetricCell
        label={`${translate("lago.customer.sales_development.ytd_last_year", { _: `ÅTD ${data.lastYear}` })} (${periode})`}
        value={kroner.format(data.ytdLastYear)}
      />
      <MetricCell
        label={translate("lago.customer.sales_development.growth_kr", {
          _: "Vækst",
        })}
        value={kroner.format(data.growthKr)}
        valueClass={growthColor}
      />
      <MetricCell
        label={translate("lago.customer.sales_development.growth_pct", {
          _: "Vækst %",
        })}
        value={data.growthPct == null ? "—" : pct.format(data.growthPct)}
        valueClass={growthColor}
      />
    </div>
  );
}

function MetricCell({
  label,
  value,
  emphasise,
  valueClass,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${emphasise ? "bg-[var(--surface-2)]" : "bg-muted/30"}`}
    >
      <div className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-sm font-bold tabular-nums ${valueClass ?? "text-[var(--fg)]"}`}
      >
        {value}
      </div>
    </div>
  );
}
