import { MapPin, Navigation, Phone, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGetIdentity, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import type { VisitStatus } from "@/lago/customers/priority";
import { useOpenOrders } from "@/lago/customers/show/useOpenOrders";
import { RowActionsMenu } from "@/lago/dashboard/RowActionsMenu";
import { PlanVisitDialog } from "@/lago/registrer/PlanVisitDialog";
import { RegistrerButton } from "@/lago/registrer/RegistrerButton";
import { useSellerLookup } from "@/lago/settings/useSellerLookup";
import { KreditSpaerreChip } from "@/lago/ui/KreditSpaerreChip";

import type { FeltCustomer } from "./customerData";

interface CustomerCardProps {
  customer: FeltCustomer;
  /**
   * grid = Dagens grid-flise (default padding + h-full)
   * list = Søg-preview + sidepanel (kompakt)
   * sheet = Kort-arket paa mobil (brief 66 §4: "Aabn kundekort" som
   *   primaer handling, Registrer sekundaer — arket er en beslutning-
   *   sværdi, ikke en registrerings-flade).
   */
  variant?: "grid" | "list" | "sheet";
}

function dotClass(status: VisitStatus): string {
  // Brief 33 §4: prikker peger på status-tokens (arver fra tokens.css).
  switch (status) {
    case "overdue":
    case "never_visited":
      return "bg-[var(--st-red)]";
    case "soon":
      return "bg-[var(--st-amber)]";
    case "on_plan":
      return "bg-[var(--st-green)]";
    default:
      return "bg-[var(--fg-3)]/40";
  }
}

function lastVisitPhrase(
  customer: FeltCustomer,
  translate: ReturnType<typeof useTranslate>,
): string {
  const days = customer.priority.daysSinceVisit;
  if (days == null) return translate("lago.customer_list.never_visited_soft");
  if (days <= 0) return translate("lago.customer_list.last_visit_today");
  if (days === 1) return translate("lago.customer_list.last_visit_yesterday");
  return translate("lago.customer_list.last_visit_n_days_ago", { n: days });
}

function buildMapsUrl(customer: FeltCustomer): string | null {
  const parts = [
    customer.address,
    customer.zipcode,
    customer.city,
    "Danmark",
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const q = encodeURIComponent(parts.join(", "));
  // maps.apple.com auto-redirects to Google Maps / native app on Android.
  // Same URL works on iOS Safari + macOS + Windows browsers.
  return `https://maps.apple.com/?q=${q}`;
}

/**
 * Fælles kort-anatomi til hele felt-fladen — Dagens grid, Søg preview
 * og (senere) kort-pin popover. Handlingsrækken følger brief 37 §1 +
 * tillæg A §1 (16. sep 2026):
 *
 *   Navnet er linket til kundekortet. "Åbn" er ikke en knap — det ville
 *   have været en femte flise ved siden af de fire andre og gjort
 *   kortets tunge element (navnet) uklikbart.
 *
 *   Handlingsrækken er venstrestillet, 44 px høj, tekstbredde: én
 *   primær (Registrér, --ink), to sekundære (Naviger, Ring), Planlæg
 *   bag ⋯. Fem lige store fliser var det brief 37 kaldte "knap-syge"
 *   — muskelhukommelsen skal genkende én stor og et par små.
 *
 *   Note-linjen er --fg-2 uden kursiv. Kursiv i Helvetica-Neue er
 *   syntetisk (brief 23 pkt 8) og bar de forkerte konnotationer
 *   (citat/mistillid) for aktivitetsnoter.
 */
export function CustomerCard({
  customer,
  variant = "grid",
}: CustomerCardProps) {
  const translate = useTranslate();
  const segment = customer.extension?.segment;
  const distrikt = customer.extension?.distrikt;
  const sellers = useSellerLookup();
  const { data: identity } = useGetIdentity();
  const { isAdmin } = useIsLagoAdmin();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;
  // Samme rolle-gate som PlanVisitButton: sælger må planlægge på egne
  // kunder, admin på tværs. Bruges til at gemme Planlæg bag ⋯ og
  // afgøre om ⋯-menuen overhovedet skal renderes.
  const canPlan =
    isAdmin || (mySalesId != null && customer.sales_id === mySalesId);
  const salesName =
    sellers.byCode(customer.extension?.visma_sales_code) ??
    customer.extension?.visma_sales_name ??
    null;
  const mapsUrl = buildMapsUrl(customer);
  const telHref = customer.phone_number ? `tel:${customer.phone_number}` : null;
  const noteQuote = customer.latestActivityDescription;
  const activityType = customer.latestActivityType;

  const [planOpen, setPlanOpen] = useState(false);

  return (
    <Card className={cn(variant === "list" ? "" : "flex h-full flex-col")}>
      <CardContent
        className={cn(
          "flex flex-col gap-3 p-4",
          variant === "list" ? "" : "flex-1",
        )}
      >
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className={cn(
              "mt-2 h-2 w-2 flex-shrink-0 rounded-full",
              dotClass(customer.priority.status),
            )}
          />
          <div className="min-w-0 flex-1">
            {/* Tillæg A §1: navnet er linket. Det tungeste element på
                kortet skal være det man klikker på for at åbne kunden —
                ellers bliver "Åbn"-knappen den femte flise. */}
            <Link
              to={`/companies/${customer.id}/show`}
              className="block truncate text-base font-bold leading-tight text-[var(--fg)] no-underline hover:underline"
            >
              {customer.name}
            </Link>
            <div className="text-muted-foreground truncate text-sm">
              {[customer.address, customer.zipcode, customer.city]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            {customer.extension?.kreditspaerre === true && (
              <div className="mt-1">
                <KreditSpaerreChip spaerret={true} />
              </div>
            )}
          </div>
          {segment && (
            <Badge variant="secondary" className="flex-shrink-0 font-normal">
              {segment}
            </Badge>
          )}
          {distrikt && (
            <Badge
              variant="outline"
              className="flex-shrink-0 font-normal text-sm"
            >
              {distrikt}
            </Badge>
          )}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                dotClass(customer.priority.status),
              )}
            />
            {lastVisitPhrase(customer, translate)}
          </span>
          {salesName && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={User} size="sm" />
                {salesName}
              </span>
            </>
          )}
          {customer.city && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={MapPin} size="sm" />
                {customer.city}
              </span>
            </>
          )}
        </div>

        <div className="text-[var(--fg-2)] text-sm">
          {noteQuote ? (
            <>
              {activityType && activityType !== "Besøg" && (
                <span className="mr-1 text-[var(--fg-3)]">
                  [{activityType}]
                </span>
              )}
              {translate("lago.felt.card.note_quote_prefix")}
              {noteQuote}
              {translate("lago.felt.card.note_quote_suffix")}
            </>
          ) : (
            <span className="text-[var(--fg-3)]">
              {translate("lago.felt.card.no_note_yet")}
            </span>
          )}
        </div>

        {/* Brief 75 §6 + tillæg C (22. sep 2026): sammendragslinjen om
            åbne ordrer på KORT-arket. Ordret samme linje som preview-
            panelet — sælgeren står i bilen og beslutter om han kører
            derhen; svaret skal være det samme uanset hvor han læser det. */}
        {variant === "sheet" && (
          <OpenOrdersSummaryLine
            vismaCustomerNo={customer.extension?.visma_customer_no ?? null}
          />
        )}

        {/* Brief 37 §1 + tillæg A §1: én venstrestillet række, 44 px høj,
            tekstbredde. Registrér = primær (--ink). Naviger + Ring =
            sekundære (--surface-3). Planlæg + Åbn kunde ligger bag ⋯
            hvis relevant — Åbn er allerede kundenavnet, så ⋯ har kun
            Planlæg tilbage (og kun når brugeren må planlægge).

            Brief 66 §4 (18. sep 2026): på KORT-arket (variant="sheet")
            er "Åbn kundekort" den primære handling — arket svarer på
            "skal jeg køre derud?", ikke på "vil jeg registrere noget?".
            Registrér bliver sekundær. Én primær per blok, som alle
            andre steder. */}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {variant === "sheet" && (
            <Button
              asChild
              className="w-auto min-w-[9rem] min-h-11 justify-center bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
            >
              <Link to={`/companies/${customer.id}/show`}>Åbn kundekort</Link>
            </Button>
          )}
          <RegistrerButton
            variant={variant === "sheet" ? "secondary" : "primary"}
            companyId={customer.id}
            companyName={customer.name}
            className="w-auto min-w-[9rem] justify-center"
          />
          <SecondaryAction
            href={mapsUrl}
            label={translate("lago.felt.card.action_navigate")}
            icon={<Icon icon={Navigation} size="sm" />}
          />
          <SecondaryAction
            href={telHref}
            label={translate("lago.felt.card.action_call")}
            icon={<Icon icon={Phone} size="sm" />}
            disabledTitle={
              !telHref ? translate("lago.felt.card.no_phone") : undefined
            }
          />
          {canPlan && (
            <RowActionsMenu
              ariaLabel={translate("lago.felt.card.more_actions", {
                _: "Flere handlinger",
              })}
              actions={[
                {
                  label: translate("lago.felt.card.action_plan"),
                  onSelect: () => setPlanOpen(true),
                },
              ]}
            />
          )}
        </div>
        {canPlan && (
          <PlanVisitDialog
            open={planOpen}
            onOpenChange={setPlanOpen}
            companyId={customer.id}
            companyName={customer.name}
            segment={customer.extension?.segment ?? null}
            currentPlannedIso={customer.extension?.next_visit_planned ?? null}
            currentNote={customer.extension?.next_visit_note ?? null}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Brief 75 §6 + tillæg C (22. sep 2026): sammendragslinjen på kortets
 * ark. Ordret samme sætning som preview-panelet — sælgeren skal ikke
 * skulle huske to formuleringer af det samme. Vises kun når kunden har
 * åbne ordrer og har et VISMA-kundenummer.
 */
const kronerFmt = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

function OpenOrdersSummaryLine({
  vismaCustomerNo,
}: {
  vismaCustomerNo: string | null;
}) {
  const query = useOpenOrders(vismaCustomerNo);
  const orders = query.data?.orders ?? [];
  const totals = query.data?.totals;
  if (!vismaCustomerNo || orders.length === 0 || !totals) return null;
  const iAltFmt = kronerFmt.format(totals.iAlt);
  const afventerFmt = kronerFmt.format(totals.afventer);
  const summary =
    totals.afventer > 0
      ? `${orders.length} ordrer · ${iAltFmt} · ${afventerFmt} afventer`
      : `${orders.length} ordrer · ${iAltFmt} · alt klar`;
  return (
    <p className="text-[length:var(--t-sec)] text-[var(--fg-2)]">{summary}</p>
  );
}

interface SecondaryActionProps {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  disabledTitle?: string;
}

// Brief 38 §3a: under 420 px vises kun ikonet så alle tre knapper får
// plads på én linje. Se CustomerActionBar for den fælles begrundelse.
function SecondaryAction({
  href,
  label,
  icon,
  disabledTitle,
}: SecondaryActionProps) {
  const secondaryClass =
    "h-11 min-w-11 gap-1.5 rounded-md bg-[var(--surface-3)] px-3 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80";
  const content = (
    <>
      {icon}
      <span className="hidden min-[420px]:inline">{label}</span>
      <span className="sr-only min-[420px]:hidden">{label}</span>
    </>
  );
  if (!href) {
    return (
      <Button
        type="button"
        variant="ghost"
        className={secondaryClass}
        disabled
        title={disabledTitle}
        aria-label={label}
      >
        {content}
      </Button>
    );
  }
  return (
    <Button
      asChild
      type="button"
      variant="ghost"
      className={secondaryClass}
      aria-label={label}
    >
      <a
        href={href}
        target={href.startsWith("tel:") ? undefined : "_blank"}
        rel="noreferrer"
      >
        {content}
      </a>
    </Button>
  );
}
