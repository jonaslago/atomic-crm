import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslate } from "ra-core";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * Diskret synk-status (Domain-brief 19 §5). Ét sted — aldrig som
 * forbehold på de enkelte widgets. Header på desktop, hamburger-menu
 * på mobil.
 *
 * Læser fra public.sync_runs_lago — seneste kørsel af enten
 * sales_monthly eller open_orders.
 *
 *   Under 24 timer siden  → neutral tekst (dæmpet)
 *   Over 24 timer siden   → amber (opmærksomhedspunkt — reelt problem)
 *   Aldrig kørt           → neutral tekst (invitation, ikke advarsel:
 *                            pre-import er normal tilstand; amber her
 *                            ville træne folk til at ignorere amber)
 *
 * Klik → /indstillinger (hvor importsiden vil bo når trin 3 leveres).
 *
 * Refetch: mount + window focus (react-query default). Ingen polling —
 * værdien ændrer sig én gang om dagen når en import køres.
 */

interface SyncRunRow {
  koert_at: string;
  datasaet: string;
}

async function fetchLatestSalesSync(): Promise<SyncRunRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sync_runs_lago")
    .select("koert_at, datasaet")
    .in("datasaet", ["sales_monthly", "open_orders"])
    .order("koert_at", { ascending: false })
    .limit(1)
    .maybeSingle<SyncRunRow>();
  if (error) throw error;
  return data;
}

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface SalgsdataSyncStatusProps {
  /** Ekstra klasser til placering — fx `hidden sm:inline-flex` for
   *  desktop-header, eller full-width padding for mobile drawer. */
  className?: string;
  /** Neutral farve-familie. Header bruger `secondary-foreground` (mod
   *  bg-secondary); drawer bruger `foreground` (mod bg-background). */
  tone?: "on-secondary" | "on-surface";
}

export function SalgsdataSyncStatus({
  className,
  tone = "on-secondary",
}: SalgsdataSyncStatusProps = {}) {
  const translate = useTranslate();
  const query = useQuery({
    queryKey: ["lago-sales-sync-status"],
    queryFn: fetchLatestSalesSync,
    // Ingen polling — værdien ændrer sig når en import køres (≈ 1x/dag).
    // React-query default: refetchOnMount + refetchOnWindowFocus dækker
    // "vis frisk værdi når fanen bliver aktiv igen".
    staleTime: 5 * 60_000,
  });

  // Under første load og ved fejl: vis intet frem for at flimre.
  if (query.isPending || query.isError) return null;

  const row = query.data;
  // Amber KUN når der findes data OG de er over et døgn gamle. Pre-import
  // ("aldrig kørt") er en invitation, ikke en advarsel — ellers træner
  // vi folk til at ignorere amber.
  const stale =
    !!row && Date.now() - new Date(row.koert_at).getTime() > ONE_DAY_MS;

  const label = row
    ? translate("lago.sync.sales.at", {
        dato: dateFmt.format(new Date(row.koert_at)),
        _: `Salgsdata synkroniseret ${dateFmt.format(new Date(row.koert_at))}`,
      })
    : translate("lago.sync.sales.never", {
        _: "Salgsdata ikke synkroniseret endnu",
      });

  const neutralClass =
    tone === "on-surface"
      ? "text-muted-foreground hover:text-foreground"
      : "text-secondary-foreground/70 hover:text-secondary-foreground";

  return (
    <Link
      to="/indstillinger"
      title={translate("lago.sync.sales.open_import", {
        _: "Åbn Indstillinger for at importere salgsdata",
      })}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1",
        "text-sm tabular-nums no-underline transition-colors",
        "hover:underline underline-offset-2",
        stale ? "text-[var(--st-amber-fg)]" : neutralClass,
        className,
      )}
    >
      <Icon icon={Clock} size="sm" />
      <span>{label}</span>
    </Link>
  );
}
