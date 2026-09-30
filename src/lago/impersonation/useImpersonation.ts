// Domain-brief 27 · Reactive state for the "Log ind som" flow.
// Tillæg A (16. sep 2026): status læses fra sessionStorage-meta,
// ikke fra en JWT-claim (Supabase-udstedt session har ingen).
//
// Timer'en fyrer end("expired") 15 s før JWT'ens exp — sådan lander
// admin tilbage som sig selv uden at ramme en auth-failed refresh
// loop først.

import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  endImpersonation,
  readImpersonationMeta,
  startImpersonation,
  type ImpersonationMeta,
} from "./session";

interface ImpersonationState {
  isImpersonating: boolean;
  meta: ImpersonationMeta | null;
  /** Milliseconds until the imperson-JWT expires. Null when no session. */
  msUntilExpiry: number | null;
}

function readState(): ImpersonationState {
  const meta = readImpersonationMeta();
  if (!meta) {
    return { isImpersonating: false, meta: null, msUntilExpiry: null };
  }
  const expiresAt = new Date(meta.expires_at).getTime();
  const msUntilExpiry = expiresAt - Date.now();
  return { isImpersonating: true, meta, msUntilExpiry };
}

export function useImpersonation() {
  const [state, setState] = useState<ImpersonationState>(readState);

  const refresh = useCallback(() => {
    setState(readState());
  }, []);

  // Keep in sync with supabase auth changes (e.g. session set/unset).
  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  // Auto-end when the JWT is about to expire. Fires 15 s before exp
  // so the user lands as themselves without the app hitting an
  // auth-failed refresh loop first.
  useEffect(() => {
    if (!state.isImpersonating || state.msUntilExpiry == null) return;
    const fireInMs = Math.max(state.msUntilExpiry - 15_000, 0);
    const timer = setTimeout(async () => {
      try {
        await endImpersonation("expired");
      } finally {
        window.location.reload();
      }
    }, fireInMs);
    return () => clearTimeout(timer);
  }, [state.isImpersonating, state.msUntilExpiry]);

  const start = useCallback(
    async (targetUserId: string) => {
      await startImpersonation({ targetUserId });
      // Reload so all queries refetch with the new session's identity.
      window.location.reload();
    },
    [],
  );

  const end = useCallback(async () => {
    await endImpersonation("manual");
    window.location.reload();
  }, []);

  return { ...state, start, end, refresh };
}
