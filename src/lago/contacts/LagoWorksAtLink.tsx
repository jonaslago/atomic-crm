import { Building2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetOne, useRecordContext, useTranslate } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";

import { Icon } from "@/lago/ui/Icon";

/**
 * Prominent "arbejder hos [kunde] →"-link on the LAGO contact page.
 * Clicking it navigates to the LAGO customer show (3c). The card style
 * mirrors the info-rail cards on the customer page so the two surfaces
 * feel like siblings. When the contact has no company yet, we render
 * a muted placeholder rather than hiding the block — sælgeren still
 * sees "kobling mangler" as a signal.
 */
export function LagoWorksAtLink({ className }: { className?: string }) {
  const translate = useTranslate();
  const contact = useRecordContext<Contact>();
  const companyId =
    contact && contact.company_id != null ? contact.company_id : null;
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId as number },
    { enabled: companyId != null },
  );

  if (!contact) return null;

  if (companyId == null) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="text-muted-foreground flex items-center gap-3 py-3 text-sm italic">
          <Icon icon={Building2} />
          {translate("lago.contact.no_company")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Link
      to={`/companies/${companyId}/show`}
      className={cn(
        "block focus-visible:outline-none",
        className,
      )}
    >
      <Card className="hover:bg-muted/40 transition-colors">
        <CardContent className="flex items-center gap-3 py-3">
          <Icon icon={Building2} className="text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-sm">
              {translate("lago.contact.works_at")}
            </div>
            <div className="truncate text-sm font-medium">
              {company?.name ?? `#${companyId}`}
            </div>
          </div>
          <span className="text-primary flex flex-shrink-0 items-center gap-1 text-sm">
            {translate("lago.contact.open_customer")}
            <Icon icon={ChevronRight} />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
