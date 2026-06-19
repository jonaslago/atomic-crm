import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslate } from "ra-core";

// Small inline badge that flags a field as VISMA-owned. Once the VISMA sync
// is live and the field becomes read-only in CRM, this badge gets a stronger
// (lock-filled) variant — for now it's an informational hint.

export function VismaBadge({ size = "sm" }: { size?: "xs" | "sm" }) {
  const translate = useTranslate();
  const isXs = size === "xs";
  return (
    <Badge
      variant="outline"
      className={
        "ml-2 inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-amber-800 font-normal" +
        (isXs ? " px-1.5 py-0 text-[10px]" : " text-xs")
      }
      title={translate("lago.customer.visma_field_explanation")}
    >
      <Lock className={isXs ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {translate("lago.customer.visma_field_badge")}
    </Badge>
  );
}
