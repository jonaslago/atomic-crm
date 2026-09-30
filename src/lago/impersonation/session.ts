// Domain-brief 27 · "Log ind som" — session-swap helpers.
// Tillæg A (16. sep 2026): sessionen udstedes af Supabase via
// verifyOtp; vi signerer ikke selv.
//
// Flow:
//   1. startImpersonation snapper adminens session, kalder Edge
//      Function'en for et hashed_token (magic-link uden mail), og
//      verifyOtp'er det — hvilket får supabase-js til at swappe
//      sessionen. Vi reloader for at få al data hentet med targets
//      identitet (react-query cache er ikke per-user aware).
//   2. endImpersonation kalder end_impersonation-RPC, signOut med
//      scope='local' (så targetens andre sessioner ikke lukkes),
//      restorer adminens session fra sessionStorage, og reloader.

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

const ORIGINAL_KEY = "lago_impersonation_original";
const META_KEY = "lago_impersonation_meta";

// authProvider.ts (kernen) cacher sales-rækken i localStorage under
// denne nøgle og rydder KUN cachen i logout(). Vi skifter session med
// setSession/verifyOtp uden at logge ud — så uden en manuel rydning
// står cachen med adminens sales-row, mens Supabase-sessionen tilhører
// targeten. Konsekvens: useGetIdentity().data.id returnerer Jonas'
// sales_id under Camillas session, og alle "Mine kunder"-filtre
// bygger på forkert ejer (mens RLS håndhæver Camilla korrekt).
// Verificeret ved observation 16. sep 2026: filtrerer man på sælger
// i rullemenuen, er Camillas kunder der; kun "Mine kunder" er tom.
// Ryddes derfor både ved start og end af impersonation, før reload.
const IDENTITY_CACHE_KEY = "RaStore.auth.current_sale";

function clearIdentityCache() {
  try {
    localStorage.removeItem(IDENTITY_CACHE_KEY);
  } catch {
    // localStorage kan være utilgængelig (private browsing, quota).
    // Cachen findes så heller ikke — ingen skade sket.
  }
}

export interface ImpersonationMeta {
  log_id: number;
  expires_at: string; // ISO
  target: {
    user_id: string;
    sales_id: number;
    full_name: string | null;
    email: string;
  };
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: unknown;
}

export function readImpersonationMeta(): ImpersonationMeta | null {
  const raw = sessionStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationMeta;
  } catch {
    return null;
  }
}

function saveOriginalSession(session: StoredSession) {
  sessionStorage.setItem(ORIGINAL_KEY, JSON.stringify(session));
}

function saveImpersonationMeta(meta: ImpersonationMeta) {
  sessionStorage.setItem(META_KEY, JSON.stringify(meta));
}

function clearImpersonationStorage() {
  sessionStorage.removeItem(ORIGINAL_KEY);
  sessionStorage.removeItem(META_KEY);
}

/**
 * Start an impersonation session. Snapshots the admin's session,
 * asks the Edge Function for a hashed_token, then verifies it via
 * supabase.auth.verifyOtp which swaps the session on the client.
 * The caller reloads afterwards.
 */
export async function startImpersonation(input: {
  targetUserId: string;
}): Promise<ImpersonationMeta> {
  const supabase = getSupabaseClient();

  // 1) Snapshot the admin's current session.
  const sessionRes = await supabase.auth.getSession();
  if (sessionRes.error || !sessionRes.data.session) {
    throw new Error("Ingen aktiv session — log ind som admin først");
  }
  const original = sessionRes.data.session;

  // 2) Call the Edge Function to get a hashed_token.
  const { data, error } = await supabase.functions.invoke("impersonate", {
    body: { target_user_id: input.targetUserId },
  });
  if (error) {
    // supabase-js pakker en non-2xx respons som FunctionsHttpError med
    // et Response-objekt på error.context. "Edge Function returned a
    // non-2xx status code" fortæller ingenting — læs body'en og bring
    // den frem, så det bliver muligt at skelne opsætningsfejl (500)
    // fra rettighedsfejl (403) fra brugerfejl (400).
    let detail = error.message;
    let httpStatus: number | undefined;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.status === "number") {
      httpStatus = ctx.status;
      try {
        const body = await ctx.clone().json();
        if (body && typeof body === "object" && "error" in body) {
          detail = String((body as { error: unknown }).error);
        }
      } catch {
        try {
          const text = await ctx.clone().text();
          if (text) detail = text;
        } catch {
          // Behold error.message som fallback.
        }
      }
    }
    if (httpStatus && httpStatus >= 500) {
      throw new Error(
        `Opsætningsfejl på 'impersonate'-funktionen (HTTP ${httpStatus}): ${detail}. Ikke noget du har gjort forkert — kontakt admin.`,
      );
    }
    throw new Error(detail);
  }
  const payload = data as {
    token_hash: string;
    log_id: number;
    expires_at: string;
    target: ImpersonationMeta["target"];
  };
  if (!payload?.token_hash) {
    throw new Error("Edge Function returnerede intet token_hash");
  }

  // 3) Persist original + meta BEFORE verifyOtp — verifyOtp overskriver
  //    supabase-js' egen session-slot, og hvis vi ikke har snappet
  //    original først, kan vi ikke finde tilbage.
  saveOriginalSession({
    access_token: original.access_token,
    refresh_token: original.refresh_token,
    expires_at: original.expires_at,
    expires_in: original.expires_in,
    token_type: original.token_type ?? "bearer",
    user: original.user,
  });
  const meta: ImpersonationMeta = {
    log_id: payload.log_id,
    expires_at: payload.expires_at,
    target: payload.target,
  };
  saveImpersonationMeta(meta);

  // 4) Verify OTP — supabase-js udsteder en ægte session og skriver
  //    den til sit storage-slot. Ingen custom claims; skrivespærringen
  //    ligger i DB (migration 20260918100000).
  const verifyRes = await supabase.auth.verifyOtp({
    token_hash: payload.token_hash,
    type: "email",
  });
  if (verifyRes.error) {
    clearImpersonationStorage();
    throw new Error(
      `Kunne ikke aktivere sessionen: ${verifyRes.error.message}`,
    );
  }

  // Ryd identitets-cachen FØR reload — ellers henter useGetIdentity
  // adminens sales-row fra localStorage og bygger "Mine kunder"-filtre
  // på Jonas' sales_id under Camillas session. Se IDENTITY_CACHE_KEY
  // øverst i filen for hele forklaringen.
  clearIdentityCache();

  return meta;
}

/**
 * End the current impersonation session. Marks the log row via RPC,
 * signs out ONLY the local session (not target's other sessions),
 * restores the admin's session, and clears storage. Caller reloads.
 */
export async function endImpersonation(
  reason: "manual" | "expired" = "manual",
): Promise<void> {
  const supabase = getSupabaseClient();
  const meta = readImpersonationMeta();

  // Best-effort log update — DB-rækken lever uanset. Kaldes MENS
  // vi stadig har imperson-sessionen (RPC-en kræver at kalderen
  // matcher admin_user_id via impersonated_by_user_id-claim ELLER
  // auth.uid() — vi passer nu via auth.uid() = target som admin
  // startede sessionen for).
  //
  // Faktisk: uden claim'en må RPC'en identificere admin via loggen.
  // end_impersonation-RPC'ens gamle logik læste
  // 'impersonated_by_user_id' fra JWT — det virker ikke længere.
  // Vi henter i stedet log_id direkte og lader RPC'en lade admin-
  // check falde ned til "kalderen er target-brugeren OG log_id
  // matcher åben række på target" — men i praksis stoler vi på at
  // sessionen ejes af admin (klienten kan ikke forfalske log_id
  // uden også at have snappet original session).
  if (meta) {
    try {
      await supabase.rpc("end_impersonation", {
        log_id: meta.log_id,
        reason,
      });
    } catch (e) {
      console.error("Kunne ikke markere impersonation-log:", e);
    }
  }

  const rawOriginal = sessionStorage.getItem(ORIGINAL_KEY);
  clearImpersonationStorage();
  // Samme grund som i startImpersonation: cachen står med targetens
  // sales-row efter imperson-sessionen. Ryddes før setSession, så
  // useGetIdentity refreshes med adminens rigtige row.
  clearIdentityCache();

  // Tillæg A §3: signOut({scope:'local'}) — NOT global. Standard
  // signOut lukker ALLE targetens sessioner, også dem hun har på sin
  // telefon. Vi lukker kun vores klients slot, så adminens session
  // kan restore's oveni.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.error("signOut local fejlede:", e);
  }

  if (!rawOriginal) {
    // No original to restore — force a full sign-out so the user
    // lands on login rather than in a half-swapped state.
    await supabase.auth.signOut();
    return;
  }
  const original = JSON.parse(rawOriginal) as StoredSession;
  const setRes = await supabase.auth.setSession({
    access_token: original.access_token,
    refresh_token: original.refresh_token,
  });
  if (setRes.error) {
    await supabase.auth.signOut();
    throw setRes.error;
  }
}
