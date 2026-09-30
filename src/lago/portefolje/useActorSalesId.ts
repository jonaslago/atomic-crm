import { useGetIdentity } from "ra-core";

/**
 * Brief 84 §1 (28. sep 2026) · sælger-id på den handlende.
 *
 * Kommer DIREKTE fra useGetIdentity og kan aldrig sættes af nogen.
 * Bevidst holdt uden for PortefoljeContext — briefen forbød at
 * skriveidentiteten kunne overskrives, og syntaktisk adskillelse
 * (denne hook mod useViewSalesId) er det stærkeste værn.
 *
 * Alle INSERT/UPDATE-mutationer der handler om "hvem gjorde det"
 * bruger denne. Skrivninger der handler om "hvem er det til"
 * (task-assignee, contact-owner) bruger useViewSalesId — briefens §4.
 */
export function useActorSalesId(): number | null {
  const { data: identity } = useGetIdentity();
  return typeof identity?.id === "number" ? identity.id : null;
}
