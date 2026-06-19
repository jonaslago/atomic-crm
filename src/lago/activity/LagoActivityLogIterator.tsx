import { Fragment } from "react";
import {
  useInfinitePaginationContext,
  useListContext,
  useTranslate,
} from "ra-core";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/admin/spinner";
import { useIsMobile } from "@/hooks/use-mobile";

import { ActivityLogCompanyCreated } from "@/components/atomic-crm/activity/ActivityLogCompanyCreated";
import { ActivityLogContactCreated } from "@/components/atomic-crm/activity/ActivityLogContactCreated";
import { ActivityLogContactNoteCreated } from "@/components/atomic-crm/activity/ActivityLogContactNoteCreated";
import { ActivityLogDealCreated } from "@/components/atomic-crm/activity/ActivityLogDealCreated";
import { ActivityLogDealNoteCreated } from "@/components/atomic-crm/activity/ActivityLogDealNoteCreated";
import {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "@/components/atomic-crm/consts";
import { InfinitePagination } from "@/components/atomic-crm/misc/InfinitePagination";
import type { Activity } from "@/components/atomic-crm/types";

import { ActivityLogCompanyNoteCreated } from "./ActivityLogCompanyNoteCreated";
import {
  COMPANY_NOTE_CREATED,
  type ActivityCompanyNoteCreated,
  type LagoActivity,
} from "./types";

// PostgREST returns view rows in snake_case (company_note, contact_note,
// deal_note). Upstream's dataProvider has a resource-specific transform for
// "activity_log" that camelCases them; "lago_activity_log" goes through the
// untransformed default path, so we normalise here in-component before
// dispatching to the renderers. This keeps the upstream dataProvider
// untouched and the renderers compatible with both feeds.
function normalize(row: unknown): LagoActivity {
  const r = row as Record<string, unknown>;
  return {
    ...(r as object),
    contactNote: r.contact_note ?? r.contactNote ?? undefined,
    dealNote: r.deal_note ?? r.dealNote ?? undefined,
    companyNote: r.company_note ?? r.companyNote ?? undefined,
  } as LagoActivity;
}

function isCompanyNote(a: LagoActivity): a is ActivityCompanyNoteCreated {
  return a.type === COMPANY_NOTE_CREATED;
}

function ActivityItem({ activity }: { activity: LagoActivity }) {
  if (isCompanyNote(activity)) {
    return <ActivityLogCompanyNoteCreated activity={activity} />;
  }
  // Fall through to upstream renderers for the upstream types.
  const upstream = activity as Activity;
  switch (upstream.type) {
    case COMPANY_CREATED:
      return <ActivityLogCompanyCreated activity={upstream} />;
    case CONTACT_CREATED:
      return <ActivityLogContactCreated activity={upstream} />;
    case CONTACT_NOTE_CREATED:
      return <ActivityLogContactNoteCreated activity={upstream} />;
    case DEAL_CREATED:
      return <ActivityLogDealCreated activity={upstream} />;
    case DEAL_NOTE_CREATED:
      return <ActivityLogDealNoteCreated activity={upstream} />;
    default:
      return null;
  }
}

/**
 * Iterator for the combined LAGO + upstream activity feed. Same structure
 * as upstream's ActivityLogIterator (loading skeletons, error retry,
 * desktop "load more" link, mobile infinite scroll), but dispatches to
 * the LAGO renderer for our new `companyNote.created` event type.
 */
export function LagoActivityLogIterator() {
  const isMobile = useIsMobile();
  const { data, isPending, error, refetch } = useListContext<LagoActivity>();
  const { hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfinitePaginationContext();
  const translate = useTranslate();

  if (isPending) {
    return (
      <div className="mt-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="mt-1 space-y-2" key={index}>
            <div className="flex flex-row items-center space-x-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
            <Separator />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data?.length) {
    return (
      <div className="p-4">
        <div className="text-muted-foreground mb-4 text-center">
          {translate("crm.dashboard.latest_activity_error", {
            _: "Fejl ved indlæsning af seneste aktivitet",
          })}
        </div>
        <div className="mt-2 text-center">
          <Button onClick={() => refetch()}>
            <RotateCcw />
            {translate("crm.common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data?.map((row, index) => {
        const activity = normalize(row);
        return (
          <Fragment key={(activity as { id: string | number }).id ?? index}>
            <ActivityItem activity={activity} />
            {index < (data?.length ?? 0) - 1 && <Separator />}
          </Fragment>
        );
      })}

      {!isMobile && hasNextPage && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            fetchNextPage();
          }}
          className="flex w-full justify-center text-sm underline hover:no-underline"
        >
          {isFetchingNextPage ? (
            <Spinner />
          ) : (
            translate("crm.activity.load_more")
          )}
        </a>
      )}

      {isMobile && (
        <div className="flex justify-center">
          <InfinitePagination />
        </div>
      )}
    </div>
  );
}
