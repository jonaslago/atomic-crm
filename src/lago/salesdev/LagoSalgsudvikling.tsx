import { TrendingDown, TrendingUp, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { VismaBadge } from "@/lago/customers/VismaBadge";
import { Icon } from "@/lago/ui/Icon";

type Period = "ytd" | "3m";

// Distrikt-modellen er Øst / Vest / HQ (brief 19, besluttet 2026-09-02).
// Distriktet ejes af VISMA og sættes via kundeimporten; værdierne matcher
// præcis companies_lago.distrikt.
const DISTRICTS = [
  { value: "all", label: "Alle distrikter" },
  { value: "Øst", label: "Øst" },
  { value: "Vest", label: "Vest" },
  { value: "HQ", label: "HQ" },
];

/**
 * Salgsudvikling page (Domain-brief 3d). Aggregated growth/decline lists,
 * district selector, and lost/new customers — all VISMA-owned, so this
 * surface is a read-only empty-state until the NOTO/VISMA sync runs.
 */
export function LagoSalgsudvikling() {
  const translate = useTranslate();
  const [period, setPeriod] = useState<Period>("ytd");
  const [district, setDistrict] = useState<string>("all");

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {translate("lago.sales_dev.title")}
            <VismaBadge size="sm" />
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {translate("lago.sales_dev.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-muted-foreground mb-1 text-sm">
              {translate("lago.sales_dev.district_label")}
            </div>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISTRICTS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="ytd">
                {translate("lago.sales_dev.period_ytd")}
              </TabsTrigger>
              <TabsTrigger value="3m">
                {translate("lago.sales_dev.period_3m")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Brief 81 §4 (23. sep 2026): siden er ikke tilsluttet endnu.
          Fire tomme kort uden banner læses som "ingen kunder er vokset,
          ingen er tabt" — praktisk forkert. Fjernes når siden tilsluttes
          v_sales_customer_periods / v_sales_district_periods. */}
      <div className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--fg-2)]">
        Ikke tilsluttet endnu — data findes, visningen mangler.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesDevList
          title={translate("lago.sales_dev.top_growth")}
          icon={
            <Icon icon={TrendingUp} className="text-[var(--st-green-fg)]" />
          }
        />
        <SalesDevList
          title={translate("lago.sales_dev.top_decline")}
          icon={
            <Icon icon={TrendingDown} className="text-[var(--st-red-fg)]" />
          }
        />
        <SalesDevList
          title={translate("lago.sales_dev.lost_customers")}
          icon={<Icon icon={UserMinus} className="text-muted-foreground" />}
        />
        <SalesDevList
          title={translate("lago.sales_dev.new_customers")}
          icon={<Icon icon={UserPlus} className="text-muted-foreground" />}
        />
      </div>
    </div>
  );
}

function SalesDevList({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  const translate = useTranslate();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <span className="h-4 w-4">{icon}</span>
          {title}
          <VismaBadge size="xs" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {translate("lago.sales_dev.empty_awaiting_visma")}
        </div>
      </CardContent>
    </Card>
  );
}
