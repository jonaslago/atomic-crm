import { CalendarClock, Navigation, Phone } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Icon } from "@/lago/ui/Icon";
import { PlanVisitDialog } from "@/lago/registrer/PlanVisitDialog";
import { RegistrerButton } from "@/lago/registrer/RegistrerButton";
import { formatPhonePairs, isDialablePhone } from "@/lago/ui/formatPhone";

/**
 * Handlingsrække på kundekortet (Domain-brief 37 §1, 16. sep 2026, rev.
 * brief 85 tillæg · 28. sep 2026).
 *
 * Reglen: én række, venstrestillet, 44 px høj, bredden er tekstens.
 * Ikon og label side ved side — ikke stakket i en flise. Fem lige store
 * kvadrater var en usikkerhed forklædt som overblik; sælgeren i døren
 * skal se ÉN primær handling og et par sekundære, ikke et gitter der
 * kræver mikrostudie.
 *
 * Fordeling pr. skærmbredde (`landscape` = ≥ 1024 px, samme tærskel som
 * `useHasSideRail`):
 *
 *   Landscape (≥ 640 px)
 *     Naviger · Ring · Planlæg · Registrér — Planlæg er sekundær, primær
 *     (Registrér, --ink) står sidst (brief 50 §3).
 *
 *   Portrait  (< 640 px)
 *     Naviger · Ring · Registrér — Planlæg er skjult her, fordi den er
 *     dækket af Planlæg-fanen i Registrér-modalen (brief 85 tillæg §b).
 *     Registrér må aldrig ryge ud i portrait; den regel står ved magt.
 *
 * NB: Planlæg-knappen var før placeret i RegistrationRail-komponenten,
 * som blev fjernet fra siden i en refaktor og efterlod knappen dødt kode.
 * Nu ligger den her (fjerde knap fra ≥ 640 px) og som femte fane i
 * Registrér-modalen (alle bredder). RegistrationRail.tsx er slettet.
 */

interface CustomerActionBarProps {
  companyId: number;
  companyName: string;
  /** Rå adressekomponenter til Naviger-linket. Alle må være null. */
  address: string | null;
  zipcode: string | null;
  city: string | null;
  /** Telefonnr til tel:-link. Null = knap disabled med forklaring. */
  phoneNumber: string | null;
  /**
   * Kundens ansvarlige sælger. Bruges til rolle-gaten på Planlæg-knappen:
   * sælger må kun planlægge på egne kunder, admin på tværs. Samme regel
   * som kort/CustomerCard bruger, så begge indgange gate'r ens.
   */
  salesId?: number | null;
  /** Auto-forslag i PlanVisitDialog (A/B/C giver "i dag + interval"). */
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  /** Prefill hvis kunden allerede har en planlagt aftale. */
  currentPlannedIso?: string | null;
  currentNote?: string | null;
  /**
   * True når viewport er ≥ 1024 px. Navnet `hasSideRail` er misvisende —
   * hooken bag (`useHasSideRail`) er en ren `matchMedia("(min-width:
   * 1024px)")`-check, ikke en orientation-check. En telefon i landskab
   * (932×430) rammer derfor false-grenen og får Registrér som primær i
   * topbaren, ikke bag den (ikke-eksisterende) skinne. Knappen og skinnen
   * styres af nøjagtig samme betingelse, så en telefon i bil-holder
   * aldrig kan miste Registrér.
   */
  hasSideRail: boolean;
  className?: string;
}

function buildMapsUrl(
  address: string | null,
  zipcode: string | null,
  city: string | null,
): string | null {
  const parts = [address, zipcode, city, "Danmark"].filter(Boolean);
  if (parts.length === 0) return null;
  const q = encodeURIComponent(parts.join(", "));
  // maps.apple.com viderestiller automatisk til Google Maps / native app
  // på Android. Samme URL virker på iOS Safari + macOS + Windows.
  return `https://maps.apple.com/?q=${q}`;
}

export function CustomerActionBar({
  companyId,
  companyName,
  address,
  zipcode,
  city,
  phoneNumber,
  salesId = null,
  segment = null,
  currentPlannedIso = null,
  currentNote = null,
  hasSideRail,
  className,
}: CustomerActionBarProps) {
  const translate = useTranslate();
  const { isAdmin } = useIsLagoAdmin();
  const viewSalesId = useViewSalesId();
  // Brief 85 tillæg (28. sep 2026): gaten spørger på VIEW-porteføljen,
  // ikke actor'en. Hvilken portefølje jeg må handle i afgøres af
  // viewSalesId (under dækning = den kollega jeg passer for); hvem
  // handlingen står i navnet på afgøres af actorSalesId (skrives via
  // PlanVisitDialog / PlanleagForm som allerede bruger useViewSalesId).
  // Uden dækning: view === actor, og gaten opfører sig som før.
  const canPlan =
    isAdmin ||
    (viewSalesId != null && salesId != null && salesId === viewSalesId);

  const [planOpen, setPlanOpen] = useState(false);
  const mapsUrl = buildMapsUrl(address, zipcode, city);
  // Brief 90 opfølgning (29. sep 2026): tel:-link kræver mindst 8 cifre
  // (dansk standard). Numre med færre cifre er ufuldstændige i VISMA —
  // en knap der ringer til dem er værre end ingen knap.
  const canDial = isDialablePhone(phoneNumber);
  const telHref = phoneNumber && canDial ? `tel:${phoneNumber}` : null;

  // Brief 50 §3 (17. sep 2026): rækkefølgen er [Naviger][Ring][Planlæg]
  // [Registrér] — primær SIDST. Øjet ender i højre kant af båndet og
  // det er der den vigtigste handling hører. Ring-knappen bærer nummeret
  // så sælgeren kan se det uden at trykke.
  const callLabel = phoneNumber
    ? `${translate("lago.felt.card.action_call")} (${formatPhonePairs(phoneNumber)})`
    : translate("lago.felt.card.action_call");
  const planLabel = currentPlannedIso
    ? translate("lago.plan_visit.rail_button_edit")
    : translate("lago.plan_visit.rail_button_new");
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      <SecondaryAction
        href={mapsUrl}
        label={translate("lago.felt.card.action_navigate")}
        icon={<Icon icon={Navigation} size="sm" />}
      />
      <SecondaryAction
        href={telHref}
        label={callLabel}
        icon={<Icon icon={Phone} size="sm" />}
        disabledTitle={
          !phoneNumber
            ? translate("lago.felt.card.no_phone")
            : !canDial
              ? `Nummeret er ufuldstændigt (${phoneNumber.replace(/\D/g, "").length} cifre)`
              : undefined
        }
      />
      {/* Brief 85 tillæg §a (28. sep 2026): Planlæg som sekundær knap,
          synlig fra ≥ 640 px (sm). Under sm dækkes den af Planlæg-fanen
          i Registrér-modalen (§b), så baren beholder tre knapper i
          portrait — Registrér skal aldrig ud af båndet. Knappen renderer
          kun når brugeren må planlægge (isAdmin eller kundens sælger). */}
      {canPlan && (
        <PlanAction
          label={planLabel}
          onClick={() => setPlanOpen(true)}
        />
      )}
      {/* Portrait: Registrér er primær og har sin plads her.
          Landscape: rail'en tager Registrér — baren skal ikke duplikere.
          Brief 49 §3 / Brief 50 §3: på laptop-kundekortet passeres
          hasSideRail=false så Registrér er MED i båndet (rail'en er
          fjernet fra kundekortet). */}
      {!hasSideRail && (
        <RegistrerButton
          variant="primary"
          companyId={companyId}
          companyName={companyName}
          className="w-auto min-w-[9rem] justify-center"
          customerSalesId={salesId}
          segment={segment}
          currentPlannedIso={currentPlannedIso}
          currentNote={currentNote}
        />
      )}
      {canPlan && (
        <PlanVisitDialog
          open={planOpen}
          onOpenChange={setPlanOpen}
          companyId={companyId}
          companyName={companyName}
          segment={segment}
          currentPlannedIso={currentPlannedIso}
          currentNote={currentNote}
        />
      )}
    </div>
  );
}

interface SecondaryActionProps {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  disabledTitle?: string;
}

// Brief 37 §1 + brief 38 §3a (16. sep 2026): sekundær = --surface-3
// baggrund, --fg tekst, 44 px høj. Under 420 px vises kun ikonet
// (labelen er skjult som sr-only) så alle tre knapper får plads på
// én linje — Registrér ~144 + Naviger + Ring med tekst passer ikke
// på 375-32 padding = 343 px. Primær handling beholder sit ord;
// sekundære klarer sig med ikon + aria-label.
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

// Brief 85 tillæg §a (28. sep 2026): Planlæg som knap-variant (ikke
// href) — samme sekundær-styling som Naviger/Ring, men skjult under
// 640 px (sm) hvor portrait-baren beholder tre knapper. Fanen i
// Registrér-modalen dækker planlægning på smalle skærme.
function PlanAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const secondaryClass =
    "hidden sm:inline-flex h-11 min-w-11 gap-1.5 rounded-md bg-[var(--surface-3)] px-3 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80";
  return (
    <Button
      type="button"
      variant="ghost"
      className={secondaryClass}
      onClick={onClick}
      aria-label={label}
    >
      <Icon icon={CalendarClock} size="sm" />
      <span className="hidden min-[420px]:inline">{label}</span>
      <span className="sr-only min-[420px]:hidden">{label}</span>
    </Button>
  );
}
