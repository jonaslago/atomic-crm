import { useState } from "react";
import { CalendarClock, ClipboardList, PenLine } from "lucide-react";

import { RegistrerModal } from "@/lago/registrer/RegistrerModal";
import { PlanVisitDialog } from "@/lago/registrer/PlanVisitDialog";
import { Button } from "@/lago/ui/Button";

import {
  DashboardKundePicker,
  type SelectedCompany,
} from "./DashboardKundePicker";

/**
 * Brief 25 (30. sep 2026): action bar at the top of the dashboard's right
 * column. Three buttons — Registrér (primary), Ny aftale (secondary),
 * Ny opgave (secondary) — each opens a customer picker first, then the
 * corresponding dialog.
 *
 * Not a widget. No Panel, no heading, no subtitle. Just the buttons,
 * matching the customer card's action bar form.
 */

type ActionIntent = "registrer" | "aftale" | "opgave" | null;

const PICKER_TITLES: Record<Exclude<ActionIntent, null>, string> = {
  registrer: "Registrér — vælg kunde",
  aftale: "Ny aftale — vælg kunde",
  opgave: "Ny opgave — vælg kunde",
};

export function DashboardActionBar() {
  const [intent, setIntent] = useState<ActionIntent>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [target, setTarget] = useState<SelectedCompany | null>(null);

  const open = (action: Exclude<ActionIntent, null>) => {
    setIntent(action);
    setPickerOpen(true);
  };

  const handleSelect = (company: SelectedCompany) => {
    setTarget(company);
    // Picker closes itself via onOpenChange(false).
  };

  const clearTarget = () => {
    setTarget(null);
    setIntent(null);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          icon={PenLine}
          primaryHeight
          onClick={() => open("registrer")}
        >
          Registrér
        </Button>
        <Button
          variant="secondary"
          icon={CalendarClock}
          onClick={() => open("aftale")}
        >
          Ny aftale
        </Button>
        <Button
          variant="secondary"
          icon={ClipboardList}
          onClick={() => open("opgave")}
        >
          Ny opgave
        </Button>
      </div>

      {/* Customer picker — shared across all three intents. */}
      <DashboardKundePicker
        open={pickerOpen}
        onOpenChange={(v) => {
          setPickerOpen(v);
          if (!v && !target) setIntent(null);
        }}
        onSelect={handleSelect}
        title={intent ? PICKER_TITLES[intent] : ""}
      />

      {/* Registrér + Aktivitet dialog (RegistrerModal). */}
      {target && intent === "registrer" && (
        <RegistrerModal
          open
          onOpenChange={(v) => {
            if (!v) clearTarget();
          }}
          companyId={target.id}
          companyName={target.name}
          segment={target.segment}
        />
      )}

      {/* Ny aftale = PlanVisitDialog. */}
      {target && intent === "aftale" && (
        <PlanVisitDialog
          open
          onOpenChange={(v) => {
            if (!v) clearTarget();
          }}
          companyId={target.id}
          companyName={target.name}
          segment={target.segment}
          onSaved={clearTarget}
        />
      )}

      {/* Ny opgave = RegistrerModal on opgave tab. */}
      {target && intent === "opgave" && (
        <RegistrerModal
          open
          onOpenChange={(v) => {
            if (!v) clearTarget();
          }}
          companyId={target.id}
          companyName={target.name}
          initialTab="opgave"
        />
      )}
    </>
  );
}
