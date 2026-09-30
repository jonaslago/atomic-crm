import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { useMemo } from "react";

import { fetchLagoSellers } from "@/lago/settings/dataAccess";

/**
 * A person who can be picked as "udført af" (Besøg/Aktivitet) or
 * "tildelt til" (Opgave).
 *
 * Brief 11 consolidates the two former sources (public.sales +
 * denormalised visma_sales_name) into one canonical list — public
 * lago_sellers. `kind` still marks the current user and the Backoffice-
 * sentinel so the picker can style them differently.
 */
export type AssignableKind = "me" | "user" | "backoffice";

export interface AssignableUser {
  /** Stable string key for the picker's <SelectItem>. */
  key: string;
  /** sales.id when the user has a real CRM login; null otherwise. */
  salesId: number | null;
  /** Display name written into customer_activities_lago.sales_name. */
  name: string;
  /** True when the canonical record is linked to a Supabase auth user. */
  hasLogin: boolean;
  kind: AssignableKind;
}

/**
 * Returns the canonical seller list for the Registrér modal.
 *
 * `includeBackoffice` = true toggles the "Backoffice" sentinel — used by
 * the Opgave-fanen where sales_id=null means "unassigned queue".
 * `activeOnly` (default true) filters out inactive sælgere.
 */
export function useAssignableUsers({
  includeBackoffice = false,
  activeOnly = true,
}: {
  includeBackoffice?: boolean;
  activeOnly?: boolean;
}): {
  options: AssignableUser[];
  me: AssignableUser | null;
  isLoading: boolean;
} {
  const { data: identity } = useGetIdentity();

  const sellersQuery = useQuery({
    queryKey: ["lago-sellers"],
    queryFn: fetchLagoSellers,
    staleTime: 5 * 60 * 1000, // 5 min — masterdata rarely changes mid-session
  });

  return useMemo(() => {
    const raw = sellersQuery.data ?? [];
    const filtered = activeOnly ? raw.filter((s) => s.active) : raw;
    const meSalesId = typeof identity?.id === "number" ? identity.id : null;

    let me: AssignableUser | null = null;
    const rest: AssignableUser[] = [];
    for (const s of filtered) {
      const entry: AssignableUser = {
        key: `seller:${s.id}`,
        salesId: s.sales_id,
        name: s.full_name,
        hasLogin: s.sales_id != null,
        kind: s.sales_id === meSalesId ? "me" : "user",
      };
      if (entry.kind === "me") me = entry;
      else rest.push(entry);
    }

    // Backup: identity user has no seller record yet — fall back so the
    // picker still has a Mig option that writes their name.
    if (!me && identity) {
      const first = (identity as { firstName?: string }).firstName ?? "";
      const last = (identity as { lastName?: string }).lastName ?? "";
      const composed = `${first} ${last}`.trim();
      const fallback = composed || (identity as { fullName?: string }).fullName;
      if (fallback && meSalesId != null) {
        me = {
          key: `me:${meSalesId}`,
          salesId: meSalesId,
          name: fallback,
          hasLogin: true,
          kind: "me",
        };
      }
    }

    // Brief 42-korrektur (16. sep 2026): sortér så valgbare står øverst.
    // Mig først (identifikation), så andre med login (alfabetisk), så
    // Backoffice-køen (gyldig, men adskilt), til sidst uden-login-rækker
    // (grå i UI'et). En liste, der er tre fjerdedele grå, er stadig en
    // dårlig liste selvom den er ærlig — så placeringen af de valgbare
    // øverst er lige så vigtig som ærligheden om de andres tilstand.
    const withLogin = rest
      .filter((r) => r.hasLogin)
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
    const withoutLogin = rest
      .filter((r) => !r.hasLogin)
      .sort((a, b) => a.name.localeCompare(b.name, "da"));

    const options: AssignableUser[] = [];
    if (me) options.push(me);
    options.push(...withLogin);

    if (includeBackoffice) {
      options.push({
        key: "backoffice",
        salesId: null,
        name: "Backoffice",
        hasLogin: false,
        kind: "backoffice",
      });
    }

    options.push(...withoutLogin);

    return { options, me, isLoading: sellersQuery.isLoading };
  }, [
    identity,
    sellersQuery.data,
    sellersQuery.isLoading,
    includeBackoffice,
    activeOnly,
  ]);
}
