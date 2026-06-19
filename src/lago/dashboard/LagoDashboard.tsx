import { useGetList } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardActivityLog } from "@/components/atomic-crm/dashboard/DashboardActivityLog";
import { DashboardStepper } from "@/components/atomic-crm/dashboard/DashboardStepper";
import { DealsChart } from "@/components/atomic-crm/dashboard/DealsChart";
import { HotContacts } from "@/components/atomic-crm/dashboard/HotContacts";
import { TasksList } from "@/components/atomic-crm/dashboard/TasksList";
import { Welcome } from "@/components/atomic-crm/dashboard/Welcome";
import MobileHeader from "@/components/atomic-crm/layout/MobileHeader";
import { MobileContent } from "@/components/atomic-crm/layout/MobileContent";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Contact, ContactNote } from "@/components/atomic-crm/types";

import { LagoLatestNotesPanel } from "./LagoLatestNotesPanel";

interface LagoNoteRow {
  id: number;
}

/**
 * LAGO dashboard — keeps upstream's full Welcome/HotContacts/DealsChart/
 * DashboardActivityLog/TasksList layout (kept so we get the colored
 * category icons and "who did what" attribution upstream's activity log
 * has), then adds LagoLatestNotesPanel as a supplemental widget so our
 * own company_notes_lago entries — which upstream's activity_log view
 * does not know about — are still visible on the dashboard.
 *
 * Stepper is bypassed once the user has notes EITHER in upstream's
 * contact_notes OR in our company_notes_lago, so the onboarding wizard
 * doesn't get stuck once the LAGO note-taking flow is in use.
 */
export function LagoDashboard() {
  const isMobile = useIsMobile();

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
  const { total: totalDeal, isPending: isPendingDeal } = useGetList("deals", {
    pagination: { page: 1, perPage: 1 },
  });

  const isPending =
    isPendingContact ||
    isPendingContactNotes ||
    isPendingLagoNotes ||
    isPendingDeal;
  if (isPending) return null;

  if (!totalContact) {
    return isMobile ? (
      <MobileWrapper>
        <DashboardStepper step={1} />
      </MobileWrapper>
    ) : (
      <DashboardStepper step={1} />
    );
  }

  const hasAnyNotes = (totalContactNotes ?? 0) + (totalLagoNotes ?? 0) > 0;
  if (!hasAnyNotes) {
    const stepper = (
      <DashboardStepper step={2} contactId={contactsData?.[0]?.id} />
    );
    return isMobile ? <MobileWrapper>{stepper}</MobileWrapper> : stepper;
  }

  if (isMobile) {
    return (
      <MobileWrapper>
        <div className="grid grid-cols-1 gap-6 mt-1">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <DashboardActivityLog />
          <LagoLatestNotesPanel limit={5} />
        </div>
      </MobileWrapper>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
      <div className="md:col-span-3">
        <div className="flex flex-col gap-4">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
        </div>
      </div>
      <div className="md:col-span-6">
        <div className="flex flex-col gap-6">
          {totalDeal ? <DealsChart /> : null}
          <DashboardActivityLog />
          <LagoLatestNotesPanel limit={5} />
        </div>
      </div>
      <div className="md:col-span-3">
        <TasksList />
      </div>
    </div>
  );
}

function MobileWrapper({ children }: { children: React.ReactNode }) {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="text-secondary-foreground flex items-center gap-2 py-3 no-underline">
          <img
            className="h-6 [.light_&]:hidden"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="h-6 [.dark_&]:hidden"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
}
