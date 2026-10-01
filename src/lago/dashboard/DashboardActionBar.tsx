import { useState } from "react";
import { CalendarClock, ClipboardList, PenLine } from "lucide-react";

import { RegistrerModal } from "@/lago/registrer/RegistrerModal";
import { Button } from "@/lago/ui/Button";

/**
 * §41b (1. okt 2026): action bar at the top of the dashboard's right
 * column. Three buttons — Registrér (primary), Ny aftale (secondary),
 * Ny opgave (secondary). Each opens the RegistrerModal directly with
 * the customer picker as step 1 inside the modal. No separate picker
 * dialog — one modal, not two.
 */

type ActionIntent = "registrer" | "aftale" | "opgave" | null;

const INTENT_TO_TAB: Record<Exclude<ActionIntent, null>, string> = {
  registrer: "besoeg",
  aftale: "planlaeg",
  opgave: "opgave",
};

export function DashboardActionBar() {
  const [intent, setIntent] = useState<ActionIntent>(null);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          icon={PenLine}
          primaryHeight
          onClick={() => setIntent("registrer")}
        >
          Registrér
        </Button>
        <Button
          variant="secondary"
          icon={CalendarClock}
          onClick={() => setIntent("aftale")}
        >
          Ny aftale
        </Button>
        <Button
          variant="secondary"
          icon={ClipboardList}
          onClick={() => setIntent("opgave")}
        >
          Ny opgave
        </Button>
      </div>

      {intent && (
        <RegistrerModal
          open
          onOpenChange={(v) => {
            if (!v) setIntent(null);
          }}
          initialTab={INTENT_TO_TAB[intent] as "besoeg" | "planlaeg" | "opgave"}
        />
      )}
    </>
  );
}
