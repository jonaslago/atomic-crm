// Domain-brief 27 §5 · "Log ind som"-knap på brugeren under Indstillinger.
//
// Sidder ved siden af "Send invitation" i SalesEdit-toolbar'en. Vises
// kun når:
//   - kalderen er LAGO-admin (useIsLagoAdmin)
//   - target'en er ikke sig selv (brief §5)
//   - vi er ikke allerede i en imperson-session (edge function
//     afviser også, men vis ikke knappen der)

import { LogIn, Loader2 } from "lucide-react";
import { useState } from "react";
import { useGetIdentity, useNotify, useRecordContext } from "ra-core";

import { Button } from "@/components/ui/button";

import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";

import { useImpersonation } from "./useImpersonation";

interface SaleRecord {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  user_id?: string | null;
  administrator?: boolean | null;
}

export function ImpersonateButton() {
  const record = useRecordContext<SaleRecord>();
  const { data: identity } = useGetIdentity();
  const { isAdmin } = useIsLagoAdmin();
  const { isImpersonating, start } = useImpersonation();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  if (!record) return null;
  if (!isAdmin) return null;
  if (isImpersonating) return null;
  // Brief §5: kan ikke være sig selv.
  if (typeof identity?.id === "number" && identity.id === record.id) {
    return null;
  }
  // Brief 27-tillæg (16. sep 2026): kan ikke være en anden admin.
  // Edge Function afviser også, men skjul knappen så den ikke rammes.
  if (record.administrator) return null;
  // Uden user_id kan Edge Function ikke slå target op.
  if (!record.user_id) return null;

  const name = [record.first_name, record.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "denne bruger";

  const handleClick = async () => {
    if (
      !window.confirm(
        `Log ind som ${name}?\n\nDu bliver sendt over i deres session (kun læsning) i 30 minutter. Alt du ser, er det de ser.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await start(record.user_id!);
      // start() reloader — vi når ikke hertil ved succes.
    } catch (e) {
      setBusy(false);
      notify(`Kunne ikke logge ind som ${name}: ${readErrorMessage(e)}`, {
        type: "error",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={busy}
      className="min-h-11 gap-1.5"
    >
      {busy ? (
        <Icon icon={Loader2} size="sm" className="animate-spin" />
      ) : (
        <Icon icon={LogIn} size="sm" />
      )}
      Log ind som {name}
    </Button>
  );
}
