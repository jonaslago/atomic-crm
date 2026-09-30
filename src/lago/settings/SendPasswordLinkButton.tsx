import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useRecordContext } from "ra-core";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { Icon } from "@/lago/ui/Icon";

import { sendPasswordLink } from "./dataAccess";

interface Sale {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  /** auth.users.id — null når sales-rækken ikke har en auth-bruger.
   *  Knappen er disabled i så fald, se kommentaren nedenfor. */
  user_id: string | null;
}

/**
 * Brief 42-korrektur (16. sep 2026) · "Send adgangskode-link".
 *
 * Erstatter det tidligere "Send invitation"-flow. LAGO's brugere
 * oprettes direkte med `email_confirm: true`, så invitation-endepunktet
 * fejler mod dem — der er ikke nogen at invitere; de findes allerede.
 * `resetPasswordForEmail` er den ene sti der virker for både en bruger
 * der aldrig har logget ind OG for en der har glemt sit kodeord.
 *
 * Sikkerheds-detalje: Supabase's endpoint returnerer OK for ukendte
 * adresser (email-enumeration-modværge). Vi skjuler den fælde ved at
 * disable knappen hvis rækken ikke har en auth-bruger — så kaldet
 * sker kun for bekræftede brugere. Indstillinger-skærmen viser i
 * forvejen "Ja · rikke@lago.dk" for eksisterende brugere.
 */
export function SendPasswordLinkButton() {
  const record = useRecordContext<Sale>();
  const mutation = useMutation({
    mutationFn: (email: string) => sendPasswordLink(email),
    onSuccess: (result) => {
      toast.success(`Adgangskode-link sendt til ${result.email}`, {
        description:
          "Brugeren får en mail med link til at sætte eller nulstille sit kodeord. Linket udløber typisk efter 24 timer.",
        duration: 8000,
      });
    },
    onError: (err) =>
      toast.error("Kunne ikke sende adgangskode-link", {
        description: readErrorMessage(err),
      }),
  });

  if (!record) return null;
  const hasAuthUser = record.user_id != null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => record.email && mutation.mutate(record.email)}
      disabled={mutation.isPending || !hasAuthUser || !record.email}
      title={
        !hasAuthUser
          ? "Brugeren har ingen konto endnu — opret én først"
          : undefined
      }
      className="min-h-11 gap-2"
    >
      {mutation.isPending ? (
        <Icon icon={Loader2} className="animate-spin" />
      ) : (
        <Icon icon={KeyRound} size="sm" />
      )}
      Send adgangskode-link
    </Button>
  );
}
