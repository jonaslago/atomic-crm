import { InfiniteListBase, type Identifier } from "ra-core";

import { ActivityLogContext } from "@/components/atomic-crm/activity/ActivityLogContext";

import { LagoActivityLogIterator } from "./LagoActivityLogIterator";

interface LagoActivityLogProps {
  /** Optional company filter — same semantics as upstream's ActivityLog. */
  companyId?: Identifier;
  pageSize?: number;
  context?: "company" | "contact" | "deal" | "all";
}

/**
 * Combined activity feed for the LAGO dashboard: reads from the
 * `lago_activity_log` view (upstream rows + LAGO company_notes_lago) and
 * renders them through upstream's renderers + our LAGO note renderer.
 */
export function LagoActivityLog({
  companyId,
  pageSize = 20,
  context = "all",
}: LagoActivityLogProps) {
  return (
    <ActivityLogContext.Provider value={context}>
      <InfiniteListBase
        resource="lago_activity_log"
        filter={companyId ? { company_id: companyId } : {}}
        sort={{ field: "date", order: "DESC" }}
        perPage={pageSize}
        disableSyncWithLocation
      >
        <LagoActivityLogIterator />
      </InfiniteListBase>
    </ActivityLogContext.Provider>
  );
}
