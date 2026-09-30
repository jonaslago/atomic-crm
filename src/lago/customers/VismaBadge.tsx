import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslate } from "ra-core";
import { Icon } from "@/lago/ui/Icon";

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
        "ml-2 inline-flex items-center gap-1 border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg-2)] font-normal" +
        (isXs ? " px-1.5 py-0 text-sm" : " text-sm")
      }
      title={translate("lago.customer.visma_field_explanation")}
    >
      <Icon icon={Lock} size="sm" />
      {translate("lago.customer.visma_field_badge")}
    </Badge>
  );
}
