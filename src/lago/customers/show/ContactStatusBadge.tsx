import { StatusPill, type StatusVariant } from "@/lago/ui/StatusPill";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";

interface ContactStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

// Map contact/note status values (from defaultNoteStatuses) to StatusPill
// variants. Semantics per design spec §4:
//   cold        -> blue   (info / early stage)
//   warm        -> amber  (warming up / advarsel)
//   hot         -> red    (urgent / kritisk)
//   in-contract -> green  (aktiv / ok)
// Anything else falls back to grey (neutral / ukendt).
const STATUS_VARIANT: Record<string, StatusVariant> = {
  cold: "blue",
  warm: "amber",
  hot: "red",
  "in-contract": "green",
};

/**
 * Small pill that mirrors the contact status colours used by upstream's
 * status configuration but shows the label as a badge rather than a dot
 * on a name — matches the mid-fi wireframe next to contact names.
 *
 * Routes through <StatusPill> per design spec §4 so status colours have
 * a single point of enforcement.
 */
export function ContactStatusBadge({
  status,
  className,
}: ContactStatusBadgeProps) {
  const { noteStatuses } = useConfigurationContext();
  if (!status) return null;
  // Brief 22a #3 (15. sep 2026): Cold/Warm/Hot/In Contract er fjernet
  // fra brugerfladen. Når noteStatuses er tom, viser vi ingen badge —
  // rå tekst ("cold" / "hot") må heller ikke vises på en dansk skærm.
  // contacts.status-kolonnen bevares i DB (kan læses igen hvis
  // noteStatuses genindføres senere).
  if (noteStatuses.length === 0) return null;
  const configured = noteStatuses.find((s) => s.value === status);
  if (!configured) return null;
  const variant = STATUS_VARIANT[status] ?? "grey";
  return (
    <StatusPill variant={variant} className={className}>
      {configured.label}
    </StatusPill>
  );
}
