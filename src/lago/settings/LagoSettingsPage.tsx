import { AlertCircle } from "lucide-react";
import { useTranslate } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";

import { Icon } from "@/lago/ui/Icon";
import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { getAppVersion } from "@/lago/layout/useAppVersion";

import { BesoegsfrekvensOverridesSection } from "./BesoegsfrekvensOverridesSection";
import { BrancherSection } from "./BrancherSection";
import { IntervalsSection } from "./IntervalsSection";
import { MaintenanceSection } from "./MaintenanceSection";
import { RolesSection } from "./RolesSection";
import { SalesCodeMapSection } from "./SalesCodeMapSection";
import { KontakterImportSection } from "./salesImport/KontakterImportSection";
import { SalesImportSection } from "./salesImport/SalesImportSection";
import { SellersSection } from "./SellersSection";
import { SyncRunsSection } from "./SyncRunsSection";
import { ImpersonationLogSection } from "@/lago/impersonation/ImpersonationLogSection";

/**
 * LAGO Indstillinger — admin-only opsætning. Brief 11 skibber to
 * sektioner: besøgsintervaller (SEG-3) og kanoniske sælgere. Fladen
 * tåler at være non-admin: viser en pæn "kun for admins"-note så
 * ikke-admin backoffice-brugere ikke render en tom side.
 */
export function LagoSettingsPage() {
  const translate = useTranslate();
  const { isAdmin, isLoading } = useIsLagoAdmin();

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {translate("lago.settings.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {translate("lago.settings.subtitle")}
          </p>
        </div>
        {/* Brief 57 §0c (17. sep 2026): bundle-hash så en telefon kan
            slå op hvad den kører. Sælger sender skærmbillede, admin
            ved præcis hvilken bundle. */}
        <p className="text-[length:var(--t-meta)] font-mono text-[var(--fg-3)]">
          Version: {getAppVersion()}
        </p>
      </header>

      {!isLoading && !isAdmin && (
        <Card className="mb-6 border-[var(--st-amber-fg)]/40 bg-[var(--st-amber-bg)]">
          <CardContent className="text-[var(--st-amber-fg)] flex items-start gap-3 py-4 text-sm">
            <Icon icon={AlertCircle} className="mt-0.5" />
            <p>{translate("lago.settings.not_admin")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <MaintenanceSection isAdmin={isAdmin} />
        <SalesImportSection isAdmin={isAdmin} />
        <KontakterImportSection isAdmin={isAdmin} />
        <SyncRunsSection />
        <IntervalsSection isAdmin={isAdmin} />
        <BesoegsfrekvensOverridesSection />
        <RolesSection isAdmin={isAdmin} />
        <BrancherSection isAdmin={isAdmin} />
        <SalesCodeMapSection isAdmin={isAdmin} />
        <SellersSection isAdmin={isAdmin} />
        <ImpersonationLogSection isAdmin={isAdmin} />
      </div>
    </div>
  );
}
