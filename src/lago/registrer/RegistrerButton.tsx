import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import { fetchLagoCustomer } from "@/lago/customers/dataAccess";

import { PlanVisitDialog } from "./PlanVisitDialog";
import { RegistrerModal } from "./RegistrerModal";
import type { TabKey } from "./RegistrerModal";

interface RegistrerButtonProps {
  companyId: number;
  companyName: string;
  /** `card` — 56 px stacked-icon (felt-cortet).
   *  `primary` — full-width filled row.
   *  `large` — extra-wide filled row.
   *  `secondary` — sekundær udseende (--surface-3), bruges i preview
   *  hvor "Åbn kundekort" er primær og Registrér er sidehandling
   *  (brief 52 tillæg A §2, 17. sep 2026). */
  variant?: "card" | "primary" | "large" | "secondary";
  initialTab?: TabKey;
  className?: string;
  segment?: "A" | "B" | "C" | "X" | "L" | null;
  currentPlannedIso?: string | null;
  currentNote?: string | null;
}

/**
 * Primær Registrér-knap (mørk --ink efter brief 22a #4, 15. sep 2026 —
 * grøn er reserveret til "Ajour"-status). Visual variants:
 *  - `card` — stacked-icon 56 px target used inside the felt CustomerCard
 *    grid (replaces the old "✓ Besøgt").
 *  - `primary` — full-width filled row, brugt i CustomerActionBar på
 *    kundekortet (brief 85 tillæg §a). Rail-varianten er slettet.
 *  - `large` — extra-wide filled row, felt-flow.
 *  - `secondary` — sekundært udseende, kundeliste-preview.
 *
 * Brief 15 · FS-20: RegistrerButton ejer også step-2 PlanVisitDialog
 * (som sibling af RegistrerModal), så "Gem & planlæg næste" virker
 * uanset om trigger er kundekortet eller et felt-kort. Ligger dialogen
 * INDE i RegistrerModal ville Radix unmounte state når parent lukkede.
 */
export function RegistrerButton({
  companyId,
  companyName,
  variant = "primary",
  initialTab = "besoeg",
  className,
  segment = null,
  currentPlannedIso = null,
  currentNote = null,
}: RegistrerButtonProps) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const [planNextOpen, setPlanNextOpen] = useState(false);
  const [planSegment, setPlanSegment] = useState<
    "A" | "B" | "C" | "X" | "L" | null
  >(null);

  const handleRequestPlanNext = async () => {
    // Slå segmentet op så auto-forslaget (i dag + interval) kan udfyldes.
    // Fejler slaget: åbn dialogen alligevel med tom dato.
    try {
      const data = await fetchLagoCustomer(companyId);
      setPlanSegment(data.extension?.segment ?? null);
    } catch {
      setPlanSegment(null);
    }
    setPlanNextOpen(true);
  };

  // Brief 22a #4 (15. sep 2026): Registrér bliver almindelig primær
  // (mørk, --ink), ikke længere teal-accent. På Dagens stod den grøn
  // tre centimeter over filterrækkens grønne "Ajour"-status — samme
  // farve med to job, altså intet. Grøn må herefter KUN betyde
  // "Ajour" (kundeliste, Dagens-filtre, kort). Formen (udfyldt knap
  // som eneste blandt kortets fem) bærer nu tydeligheden — ikke farven.
  const primaryBtn =
    "bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90 focus-visible:ring-[var(--ink)]/40";

  return (
    <>
      {variant === "card" ? (
        <Button
          variant="default"
          className={cn(
            "flex h-14 flex-col gap-0.5 rounded-md px-2 py-1 text-sm",
            primaryBtn,
            className,
          )}
          onClick={() => setOpen(true)}
          aria-label={translate("lago.registrer.button")}
          title={translate("lago.registrer.button_hint")}
        >
          <Icon icon={CheckCircle2} size="lg" />
          <span>{translate("lago.felt.card.action_register")}</span>
        </Button>
      ) : variant === "large" ? (
        <Button
          size="lg"
          className={cn(
            "h-12 w-full gap-2 text-base font-bold",
            primaryBtn,
            className,
          )}
          onClick={() => setOpen(true)}
        >
          <Icon icon={CheckCircle2} size="lg" />
          {translate("lago.registrer.button")}
        </Button>
      ) : variant === "secondary" ? (
        // Brief 52 tillæg A §2 (17. sep 2026): sekundært udseende
        // matcher LagoButton variant="secondary" — --surface-3 bg,
        // --fg tekst, 44 px høj. Bruges i preview-panelet hvor
        // "Åbn kundekort" er den primære.
        <Button
          className={cn(
            "min-h-11 w-full justify-center gap-2",
            "bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-3)]/80",
            className,
          )}
          onClick={() => setOpen(true)}
        >
          <Icon icon={CheckCircle2} />
          {translate("lago.registrer.button")}
        </Button>
      ) : (
        // Brief 58 §3 (17. sep 2026): min-h-11 så primær-varianten
        // flugter med SecondaryAction-knapperne i CustomerActionBar
        // (Navigér, Ring — begge 44 px). shadcn's Button-default er
        // h-9 = 36 px, som var under trykmålet på det vigtigste
        // element på skærmen.
        <Button
          className={cn(
            "min-h-11 w-full justify-start gap-2",
            primaryBtn,
            className,
          )}
          onClick={() => setOpen(true)}
        >
          <Icon icon={CheckCircle2} />
          {translate("lago.registrer.button")}
        </Button>
      )}

      <RegistrerModal
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        companyName={companyName}
        initialTab={initialTab}
        onRequestPlanNext={handleRequestPlanNext}
        segment={segment}
        currentPlannedIso={currentPlannedIso}
        currentNote={currentNote}
      />
      <PlanVisitDialog
        open={planNextOpen}
        onOpenChange={setPlanNextOpen}
        companyId={companyId}
        companyName={companyName}
        segment={planSegment}
      />
    </>
  );
}
