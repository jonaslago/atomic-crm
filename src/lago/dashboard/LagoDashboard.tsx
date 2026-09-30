import { useGetList } from "ra-core";

import { DashboardStepper } from "@/components/atomic-crm/dashboard/DashboardStepper";
import { Welcome } from "@/components/atomic-crm/dashboard/Welcome";
import type { Contact, ContactNote } from "@/components/atomic-crm/types";

// Brief 36 §2: LagoDashboardActivityLog er fjernet fra dashboardet.
// Feed'et viste importstøj — "Du tilføjede virksomhed X yesterday
// at 1:52 PM" gange 1.164 kunder, engelsk og maskinskabt. Komponenten
// + view'en består (kan trækkes tilbage når filteret er på plads),
// men vises ikke på dashboardet. En tom sektion er bedre end ti
// linjer maskinstøj.
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import { usePortefolje } from "@/lago/portefolje/PortefoljeContext";
import { LagoPullToRefresh } from "@/lago/ui/PullToRefresh";
import { DashboardGrid } from "./DashboardGrid";

interface LagoNoteRow {
  id: number;
}

/**
 * LAGO dashboard (Domain-brief 18).
 *
 * Rolle-baseret: DashboardGrid slår current user's lago_role op og
 * rendrer den layout-liste der er defineret i roleLayouts.ts. Ingen
 * felt/backoffice-omskifter — rollen ér tilstanden.
 *
 * Fortsat bevaret ovenpå grid'et:
 *   - Onboarding-stepper for tomme accounts (upstream)
 *   - Aktivitets-feed (LagoDashboardActivityLog) som "hvad skete der
 *     lige"-spor under widgets
 */
export function LagoDashboard() {
  // §6 (30. sep 2026): header follows viewRole (the layout being rendered),
  // not the user's static role. An admin viewing kontor's dashboard sees
  // "Kontorets arbejde", not "Hvad skal jeg gøre nu?". isLoading from
  // useCurrentLagoRole guards the first render (same as DashboardGrid).
  const { isLoading: roleLoading } = useCurrentLagoRole();
  const { viewRole: role } = usePortefolje();

  const {
    data: contactsData,
    total: totalContact,
    isPending: isPendingContact,
  } = useGetList<Contact>("contacts", { pagination: { page: 1, perPage: 1 } });
  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contact_notes", {
      pagination: { page: 1, perPage: 1 },
    });
  const { total: totalLagoNotes, isPending: isPendingLagoNotes } =
    useGetList<LagoNoteRow>("company_notes_lago", {
      pagination: { page: 1, perPage: 1 },
    });

  const isPending =
    roleLoading ||
    isPendingContact ||
    isPendingContactNotes ||
    isPendingLagoNotes;
  if (isPending) return null;

  // Brief 38 §1 (16. sep 2026): tidligere pakkede dashboardet sig ind
  // i en `<MobileHeader>` med LAGO-logoet, oven på den `<LagoHeader>`
  // som LagoLayout allerede rendrer på alle bredder. Det gav to
  // headere oven på hinanden på telefon — logo-bjælken dækkede synk-
  // linjen, så "sep., 14.36" stak ud bagved. LagoHeader er appens
  // eneste header. Dashboardet skal bare rendere sit indhold.

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

  const hasAnyNotes = (totalContactNotes ?? 0) + (totalLagoNotes ?? 0) > 0;
  if (!hasAnyNotes) {
    return <DashboardStepper step={2} contactId={contactsData?.[0]?.id} />;
  }

  // Brief 85 §13 (28. sep 2026): HvadSkalJegGoereNu-widget fjernet.
  // Den duplikerede sektion 1 (Dagens besøg) og forsvinder helt fra
  // dashboardet. Sidens H1 + datolinje bevares — det er dashboardets
  // egen overskrift, ikke widget'en.
  //
  // Brief 90 opfølgning (29. sep 2026): kontoret får sin egen H1.
  // "Overblik og næste aftaler" var sælgerens sætning; kontoret har
  // ingen aftaler — det har arbejdsbunker.
  const dateFmt = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const datoLinje = dateFmt.format(new Date());
  // §6 (30. sep 2026): header follows the rendered layout, not the user's
  // static role. `role` is viewRole from PortefoljeContext — same source
  // DashboardGrid uses to pick the widget set. Admin viewing kontor sees
  // "Kontorets arbejde"; admin viewing ledelse sees no header.
  const header =
    role === "saelger"
      ? {
          h1: "Hvad skal jeg gøre nu?",
          sub: `Overblik og næste aftaler for ${datoLinje}`,
        }
      : role === "kontor" || role === "admin"
        ? {
            h1: "Kontorets arbejde",
            sub: `Bunker og lister for ${datoLinje}`,
          }
        : null;
  return (
    <LagoPullToRefresh>
      <div className="flex flex-col gap-10">
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
        {header && (
          <header>
            <h1 className="text-[clamp(1.375rem,1.15rem+1.1cqi,1.75rem)] font-bold tracking-tight text-[var(--fg)]">
              {header.h1}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--fg-2)]">{header.sub}</p>
          </header>
        )}
        <DashboardGrid />
      </div>
    </LagoPullToRefresh>
  );
}
