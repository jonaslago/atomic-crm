-- Tillæg A til brief 27 (16. sep 2026): session udstedt af Supabase,
-- spærring håndhævet i databasen — ikke i en JWT-claim.
--
-- Baggrund: GOAL CRM signerer med ECC (P-256), og Supabase udleverer
-- ikke den private nøgle. HS256 "PREVIOUS KEY" kan verificere gamle
-- tokens men skal ikke bruges til nye signaturer — dashboardet inviterer
-- til at revoke'e den, og "Log ind som" ville holde op med at virke
-- uden nogen forklaring, den dag det sker.
--
-- Ny model:
--   - Edge Function kalder admin.generateLink + klienten verifyOtp.
--     Sessionen er Supabase-udstedt, kan ikke bære custom claims.
--   - Skrivespærringen læser i stedet impersonation_log_lago: findes
--     en åben række for auth.uid() inden for de sidste 30 min → blok.
--     Sporet og spærringen bliver det samme faktum, ét sted.
--
-- Tre stykker:
--
--   1. FK'er på admin_sales_id + target_sales_id → sales(id). Uden dem
--      kan PostgREST ikke resolve embed'et i ImpersonationLogSection,
--      så visningen viser "Kunne ikke hente revisionsspor" uanset at
--      rækker skrives korrekt.
--
--   2. Filter-index på (target_user_id) WHERE ended_at IS NULL, så
--      guard-triggerens EXISTS-check ikke skanner hele tabellen ved
--      hver skrivning.
--
--   3. Genskriv block_write_when_impersonating: SECURITY DEFINER
--      (fordi Camillas RLS ikke må kunne se admin-loggen normalt) +
--      lookup i tabellen i stedet for claim-check. Triggeren står
--      stadig på alle 16 tabeller — kun betingelsen ændres.

-- 1) Foreign keys på sales-referencer
ALTER TABLE public.impersonation_log_lago
    DROP CONSTRAINT IF EXISTS impersonation_log_lago_admin_sales_id_fkey,
    ADD  CONSTRAINT impersonation_log_lago_admin_sales_id_fkey
        FOREIGN KEY (admin_sales_id) REFERENCES public.sales (id)
        ON DELETE SET NULL;

ALTER TABLE public.impersonation_log_lago
    DROP CONSTRAINT IF EXISTS impersonation_log_lago_target_sales_id_fkey,
    ADD  CONSTRAINT impersonation_log_lago_target_sales_id_fkey
        FOREIGN KEY (target_sales_id) REFERENCES public.sales (id)
        ON DELETE SET NULL;

-- 2) Hot-path index for guard-triggerens EXISTS-check
CREATE INDEX IF NOT EXISTS impersonation_log_open_by_target_idx
    ON public.impersonation_log_lago (target_user_id)
    WHERE ended_at IS NULL;

-- 3) Genskriv guard-funktionen
--
-- SECURITY DEFINER: Camilla har ingen SELECT-policy på
-- impersonation_log_lago (kun admin læser), så uden DEFINER ville
-- EXISTS altid returnere false under Camillas session — og hele
-- pointen var at spærre HENDE. Funktionen ejes af postgres/db-ejer,
-- som bypasser RLS.
--
-- Betingelsen: åben række for auth.uid(), startet inden for 30 min.
-- Både ended_at IS NULL OG et tidsvindue — så en glemt/crashed
-- session ikke bliver til en permanent spærring på Camilla.
CREATE OR REPLACE FUNCTION public.block_write_when_impersonating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.impersonation_log_lago
         WHERE target_user_id = auth.uid()
           AND ended_at IS NULL
           AND started_at > now() - interval '30 minutes'
    ) THEN
        RAISE EXCEPTION
            'Skrivning er ikke tilladt under "Log ind som" — sessionen er læse-only. Afslut sessionen og udfør handlingen som dig selv.'
            USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggerne på de 16 tabeller peger stadig på samme funktionsnavn —
-- ingen DROP/CREATE nødvendig, kun function-body'en er ny.

-- 4) Genskriv end_impersonation-RPC til det nye session-model.
--
-- Den gamle version læste 'impersonated_by_user_id'-claim'en fra
-- JWT for at identificere den admin, der startede sessionen. Med
-- Supabase-udstedt session findes claim'en ikke — kalderen er nu
-- target-brugeren (Camilla), ikke admin.
--
-- Ny logik: kalderen skal være target for den åbne log-række med
-- det angivne id. Så kan kun én i imperson-sessionen afslutte den —
-- og for at have log_id i første omgang, skal admin have skrevet
-- den til sin sessionStorage (Edge Function returnerer log_id kun
-- til admin ved start).
CREATE OR REPLACE FUNCTION public.end_impersonation(
    log_id bigint,
    reason text DEFAULT 'manual'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log RECORD;
BEGIN
    IF reason NOT IN ('manual', 'expired', 'unknown') THEN
        RAISE EXCEPTION 'Ugyldig ended_reason: %', reason;
    END IF;

    SELECT * INTO v_log
      FROM public.impersonation_log_lago
     WHERE id = log_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Impersonation-log % findes ikke', log_id;
    END IF;

    IF v_log.ended_at IS NOT NULL THEN
        -- Idempotent — allerede afsluttet.
        RETURN;
    END IF;

    -- Kalderen skal være target-brugeren i den åbne session.
    -- Under en imperson-session er auth.uid() = target_user_id.
    -- Denne check er tilstrækkelig, fordi log_id kun sendes til
    -- klienten når admin starter sessionen — en anden target-user
    -- kender ikke andres log_id.
    IF v_log.target_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Kun den aktive impersonation-session kan afslutte sig selv';
    END IF;

    UPDATE public.impersonation_log_lago
       SET ended_at = now(),
           ended_reason = reason
     WHERE id = log_id;
END;
$$;

-- GRANT er allerede sat fra 20260918000000.
