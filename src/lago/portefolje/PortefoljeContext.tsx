import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";
import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";

import {
  clearCoverage,
  clearRoleView,
  readCoverage,
  readRoleView,
  updateCoverageLogId,
  writeCoverage,
  writeRoleView,
  type StoredCoverage,
} from "./portefoljeStorage";
import {
  endCoverageLog,
  startCoverageLog,
} from "./coverageMutations";
import { useAuthUserId } from "./useAuthUserId";

/**
 * Brief 84 (28. sep 2026) · portefolje-context — den ene læsetilstand.
 *
 * Al FILTRERING i widgets og lister bruger viewSalesId/viewRole herfra.
 * Al SKRIVNING bruger useActorSalesId (separat hook) — den er aldrig
 * her, og det er med vilje: briefens §1 kræver at skrive-identiteten
 * ikke kan overskrives, og syntaktisk adskillelse er det mest sikre
 * værn mod at nogen en dag læser den fra samme sted.
 *
 * Tre tilstande:
 *   1) Normal      — viewSalesId = mig, viewRole = min rolle
 *   2) Se som rolle — viewSalesId = mig, viewRole = valgt rolle
 *   3) Passer for   — viewSalesId = kollega, viewRole = kollegas rolle
 *
 * 2 og 3 er gensidigt udelukkende (tillæg A §3). Vælger man en person,
 * følger hendes rolle med — at kombinere "kontorets layout med
 * Camillas data" er ikke ønskeligt.
 */

export interface PortefoljeState {
  viewSalesId: number | null;
  viewRole: LagoRole;
  viewLabel: string | null;
  isCovering: boolean;
  isRoleView: boolean;
  actorRole: LagoRole;
  coverage: StoredCoverage | null;
}

export interface PortefoljeActions {
  startCoverage: (target: {
    salesId: number;
    userId: string;
    label: string;
    role: LagoRole;
  }) => Promise<void>;
  endCoverage: () => Promise<void>;
  setRoleView: (role: LagoRole) => void;
  clearRoleView: () => void;
}

type PortefoljeContextValue = PortefoljeState & PortefoljeActions;

const PortefoljeContext = createContext<PortefoljeContextValue | null>(null);

const VALID_ROLES: LagoRole[] = ["saelger", "kontor", "ledelse", "admin"];

interface Props {
  children: ReactNode;
}

export function PortefoljeProvider({ children }: Props) {
  const { data: identity } = useGetIdentity();
  const { role: actorRole } = useCurrentLagoRole();
  const actorSalesId =
    typeof identity?.id === "number" ? identity.id : null;
  // useGetIdentity giver kun sales.id — auth.uid() (uuid) hentes
  // separat fordi coverage_log_lago.covering_user_id kræver den.
  const actorUserId = useAuthUserId();

  // sessionStorage-baseret state. useState-tallet stiger når vi selv
  // ændrer noget — så context'en re-render'er. Storage er sandheden;
  // tallet er blot en tick.
  const [tick, setTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  // Bootstrap fra URL: hvis en delt link har ?passer=X eller ?somRolle=Y,
  // skriv til sessionStorage og ryd param'en. Én-gangs — derefter er
  // sessionStorage kilden.
  useEffect(() => {
    const passer = searchParams.get("passer");
    const somRolle = searchParams.get("somRolle") as LagoRole | null;
    let mutated = false;
    if (passer && /^\d+$/.test(passer)) {
      const passerId = Number(passer);
      // Kun bootstrap hvis der ikke allerede er en dækning kørende —
      // så en delt link ikke overskriver aktivt arbejde.
      if (!readCoverage()) {
        // Vi ved kun sales_id fra URL — hent resten fra basen, så
        // viewLabel og viewRole er korrekte. Sker asynkront via
        // coveredPersonQuery nedenfor; her tegner vi kun et
        // pladsholder-objekt så URL-bootstrappen tælles som "brugt".
        writeCoverage({
          targetSalesId: passerId,
          targetUserId: "",
          targetLabel: "…",
          targetRole: "saelger",
          logId: null,
        });
        setTick((t) => t + 1);
      }
      mutated = true;
    }
    if (somRolle && VALID_ROLES.includes(somRolle)) {
      if (!readCoverage() && !readRoleView()) {
        writeRoleView(somRolle);
        setTick((t) => t + 1);
      }
      mutated = true;
    }
    if (mutated) {
      // Fjern URL-param'erne — sessionStorage har dem nu, og en
      // næste-genindlæsning vil læse fra sessionStorage.
      const next = new URLSearchParams(searchParams);
      next.delete("passer");
      next.delete("somRolle");
      setSearchParams(next, { replace: true });
    }
    // Kør kun én gang ved mount — vi vil ikke re-bootstrappe hvis
    // URL'en ændrer sig på anden vis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Læs storage hver render (tick sikrer opdatering ved lokale ændringer).
  const storedCoverage = useMemo(() => readCoverage(), [tick]);
  const storedRoleView = useMemo(() => readRoleView(), [tick]);

  // Bootstrap-pladsholderen havde tomme felter. Hvis dækning er aktiv
  // og targetUserId er tomt, henter vi rækken og opdaterer storage.
  const needsHydration =
    storedCoverage != null && storedCoverage.targetUserId === "";

  const hydrateQuery = useQuery({
    queryKey: ["lago-portefolje-hydrate", storedCoverage?.targetSalesId],
    queryFn: async () => {
      if (storedCoverage == null) return null;
      const { data, error } = await getSupabaseClient()
        .from("sales")
        .select("id, user_id, first_name, last_name, lago_role")
        .eq("id", storedCoverage.targetSalesId)
        .single<{
          id: number;
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          lago_role: LagoRole | null;
        }>();
      if (error) throw error;
      return data;
    },
    enabled: needsHydration,
    staleTime: 5 * 60 * 1000,
  });

  // Brief 84 opfølgning A (28. sep 2026): URL-bootstrap skal også logge.
  // useRef-lås beskytter mod dobbelt-insert hvis effect kører to gange
  // (React strict mode, hurtig re-render). Uden låsen kunne en URL-
  // bootstrap ende med to log-rækker.
  const bootstrapLogAttempted = useRef(false);

  useEffect(() => {
    if (!needsHydration) return;
    const row = hydrateQuery.data;
    if (!row) return;
    const label =
      `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || `#${row.id}`;
    writeCoverage({
      targetSalesId: row.id,
      targetUserId: row.user_id,
      targetLabel: label,
      targetRole: (row.lago_role ?? "saelger") as LagoRole,
      logId: storedCoverage?.logId ?? null,
    });
    setTick((t) => t + 1);

    // URL-bootstrap-log: kald KUN én gang, kun hvis der ikke allerede
    // er en logId (dvs. det er en fane der åbnede et delt link, ikke
    // en tab-swap efter menu-startet dækning).
    if (
      !bootstrapLogAttempted.current &&
      storedCoverage?.logId == null &&
      actorUserId != null
    ) {
      bootstrapLogAttempted.current = true;
      void (async () => {
        const logId = await startCoverageLog({
          coveringUserId: actorUserId,
          coveringSalesId: actorSalesId,
          coveredUserId: row.user_id,
          coveredSalesId: row.id,
        });
        if (logId != null) {
          updateCoverageLogId(logId);
          setTick((t) => t + 1);
        }
      })();
    }
  }, [
    needsHydration,
    hydrateQuery.data,
    storedCoverage?.logId,
    actorUserId,
    actorSalesId,
  ]);

  // Brief 84 opfølgning D (28. sep 2026): efterladte åbne dæknings-
  // rækker skal lukkes. Bruger går hjem uden at trykke "Tilbage til
  // mine" → rækken står åben. Cleanup ved app-start lukker alle egne
  // åbne rækker ældre end 12 timer med ended_reason='unknown' — samme
  // "vi ved det ikke skal kunne skelnes fra vi ved det"-princip som
  // brief 64's tasks.created_at. 12-timers-tærsklen beskytter samme-
  // dags flerfane-brug: en aktiv session i én fane rammes ikke af
  // cleanup fra en anden fanes app-start.
  const cleanupAttempted = useRef(false);
  useEffect(() => {
    if (cleanupAttempted.current) return;
    if (actorUserId == null) return;
    // Har vi selv en aktiv session i sessionStorage, springer vi over —
    // egen session lukkes ved "Tilbage til mine", ikke af cleanup.
    if (readCoverage()) return;
    cleanupAttempted.current = true;
    const twelveHoursAgoIso = new Date(
      Date.now() - 12 * 60 * 60 * 1000,
    ).toISOString();
    void (async () => {
      const { error } = await getSupabaseClient()
        .from("coverage_log_lago")
        .update({
          ended_at: new Date().toISOString(),
          ended_reason: "unknown",
        })
        .eq("covering_user_id", actorUserId)
        .is("ended_at", null)
        .lt("started_at", twelveHoursAgoIso);
      if (error) {
        console.error("Kunne ikke lukke gamle dæknings-rækker:", error);
      }
    })();
  }, [actorUserId]);

  const startCoverage = useCallback(
    async (target: {
      salesId: number;
      userId: string;
      label: string;
      role: LagoRole;
    }) => {
      if (actorUserId == null) return;
      // Skriv tilstand først så UI reagerer med det samme; log-rækken
      // hentes umiddelbart efter og patches ind.
      writeCoverage({
        targetSalesId: target.salesId,
        targetUserId: target.userId,
        targetLabel: target.label,
        targetRole: target.role,
        logId: null,
      });
      // Rolleview og dækning er gensidigt udelukkende — slå rolleview
      // fra hvis den var aktiv.
      clearRoleView();
      setTick((t) => t + 1);
      const logId = await startCoverageLog({
        coveringUserId: actorUserId,
        coveringSalesId: actorSalesId,
        coveredUserId: target.userId,
        coveredSalesId: target.salesId,
      });
      if (logId != null) {
        updateCoverageLogId(logId);
        setTick((t) => t + 1);
      }
    },
    [actorUserId, actorSalesId],
  );

  const endCoverage = useCallback(async () => {
    const current = readCoverage();
    clearCoverage();
    setTick((t) => t + 1);
    if (current?.logId != null) {
      await endCoverageLog(current.logId, "manual");
    }
  }, []);

  const setRoleView = useCallback((role: LagoRole) => {
    // Rolleview og dækning er gensidigt udelukkende.
    clearCoverage();
    writeRoleView(role);
    setTick((t) => t + 1);
  }, []);

  const clearRoleViewAction = useCallback(() => {
    clearRoleView();
    setTick((t) => t + 1);
  }, []);

  const state: PortefoljeState = useMemo(() => {
    if (storedCoverage) {
      return {
        viewSalesId: storedCoverage.targetSalesId,
        viewRole: storedCoverage.targetRole,
        viewLabel: storedCoverage.targetLabel,
        isCovering: true,
        isRoleView: false,
        actorRole,
        coverage: storedCoverage,
      };
    }
    if (storedRoleView) {
      return {
        viewSalesId: actorSalesId,
        viewRole: storedRoleView,
        viewLabel: null,
        isCovering: false,
        isRoleView: true,
        actorRole,
        coverage: null,
      };
    }
    return {
      viewSalesId: actorSalesId,
      viewRole: actorRole,
      viewLabel: null,
      isCovering: false,
      isRoleView: false,
      actorRole,
      coverage: null,
    };
  }, [storedCoverage, storedRoleView, actorSalesId, actorRole]);

  const value: PortefoljeContextValue = useMemo(
    () => ({
      ...state,
      startCoverage,
      endCoverage,
      setRoleView,
      clearRoleView: clearRoleViewAction,
    }),
    [state, startCoverage, endCoverage, setRoleView, clearRoleViewAction],
  );

  return (
    <PortefoljeContext.Provider value={value}>
      {children}
    </PortefoljeContext.Provider>
  );
}

function usePortefoljeContext(): PortefoljeContextValue {
  const ctx = useContext(PortefoljeContext);
  if (!ctx) {
    throw new Error(
      "usePortefolje kaldt uden for <PortefoljeProvider> — wrap App'et først",
    );
  }
  return ctx;
}

export function usePortefolje(): PortefoljeState {
  const ctx = usePortefoljeContext();
  return ctx;
}

export function usePortefoljeActions(): PortefoljeActions {
  const ctx = usePortefoljeContext();
  return ctx;
}

/**
 * Sælger-id på den portefølje vi FILTRERER for. Under dækning: kollegas.
 * Ellers: brugerens egen. Bruges af widgets og lister — aldrig af
 * skrivninger. Skrivninger bruger useActorSalesId.
 */
export function useViewSalesId(): number | null {
  const { viewSalesId } = usePortefolje();
  return viewSalesId;
}

/**
 * Rollen der styrer dashboard-layoutet. Under dækning: kollegas rolle.
 * Under "Se som rolle": den valgte rolle. Ellers: brugerens egen.
 */
export function useViewRole(): LagoRole {
  const { viewRole } = usePortefolje();
  return viewRole;
}

export function useIsCovering(): boolean {
  const { isCovering } = usePortefolje();
  return isCovering;
}
