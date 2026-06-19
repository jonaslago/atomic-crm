import { Clock } from "lucide-react";
import { useTranslate } from "ra-core";

import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { LagoActivityLog } from "./LagoActivityLog";

/**
 * Drop-in replacement for upstream's DashboardActivityLog that reads from
 * the combined LAGO feed (`lago_activity_log` view). Same visual shell
 * (Clock icon, "Seneste aktivitet" heading, mobile/desktop layout).
 */
export function LagoDashboardActivityLog() {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center md:mb-2">
        <div className="mr-3 flex">
          <Clock className="text-muted-foreground h-6 w-6" />
        </div>
        <h2 className="text-muted-foreground text-xl font-semibold">
          {translate("crm.dashboard.latest_activity", {
            _: "Seneste aktivitet",
          })}
        </h2>
      </div>
      {isMobile ? (
        <LagoActivityLog pageSize={10} />
      ) : (
        <Card className="mb-2 p-6">
          <LagoActivityLog pageSize={10} />
        </Card>
      )}
    </div>
  );
}
