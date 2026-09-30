import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Icon } from "@/lago/ui/Icon";
import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { fetchLagoCustomer } from "@/lago/customers/dataAccess";

import { PlanVisitDialog } from "./PlanVisitDialog";

interface PlanVisitButtonProps {
  companyId: number;
  companyName: string;
  /**
   * Kundens ansvarlige sælger. Bruges til rolle-gate — sælger må planlægge
   * på egne kunder, admin/backoffice på tværs. Aldrig person-bundet.
   */
  salesId: number | null;
  variant?: "card";
  className?: string;
}

/**
 * Brief 15 (addendum): direkte "Planlæg besøg"-genvej i felt-fladens
 * delte handlingsrække på CustomerCard. Åbner PlanVisitDialog direkte
 * med segment-auto-forslag — uden at åbne kundekortet, uden at
 * registrere et besøg. Returnerer null hvis brugeren ikke må planlægge,
 * så CustomerCard kan skifte grid-layout uden en tom slot.
 */
export function PlanVisitButton({
  companyId,
  companyName,
  salesId,
  variant = "card",
  className,
}: PlanVisitButtonProps) {
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  const { isAdmin } = useIsLagoAdmin();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const canPlan =
    isAdmin || (mySalesId != null && salesId === mySalesId);

  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<
    "A" | "B" | "C" | "X" | "L" | null
  >(null);
  const [current, setCurrent] = useState<{
    iso: string | null;
    note: string | null;
  }>({ iso: null, note: null });

  const handleClick = async () => {
    // Slå segment + eksisterende planlægning op, så auto-forslaget +
    // prefill af redigering er klar før dialogen åbner. Fejler slaget:
    // åbn med tomme felter.
    try {
      const data = await fetchLagoCustomer(companyId);
      setSegment(data.extension?.segment ?? null);
      setCurrent({
        iso: data.extension?.next_visit_planned ?? null,
        note: data.extension?.next_visit_note ?? null,
      });
    } catch {
      setSegment(null);
      setCurrent({ iso: null, note: null });
    }
    setOpen(true);
  };

  if (!canPlan) return null;

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "flex h-14 flex-col gap-0.5 rounded-md px-2 py-1 text-sm",
          className,
        )}
        onClick={handleClick}
        aria-label={translate("lago.plan_visit.rail_button_new")}
      >
        <Icon icon={CalendarClock} size="lg" className="text-[var(--ink)]" />
        <span>{translate("lago.felt.card.action_plan")}</span>
      </Button>
      <PlanVisitDialog
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        companyName={companyName}
        segment={segment}
        currentPlannedIso={current.iso}
        currentNote={current.note}
      />
    </>
  );
}
