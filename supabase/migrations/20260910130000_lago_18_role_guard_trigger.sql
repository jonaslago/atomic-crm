-- LAGO Domain-brief 18 §1 — server-side beskyttelse af rolle-felter.
--
-- To lag:
--   1. RLS UPDATE-policy: kun admins må opdatere sales via
--      authenticated-clienten. Upstream's "brugere opdaterer egen
--      profile" går via users-edge-functionen med service_role, som
--      ikke berøres af RLS — så vi brækker ikke noget.
--   2. BEFORE UPDATE trigger: håndhæver at rolle-felter specifikt kun
--      kan ændres af admins. Belt+suspenders: hvis policyen senere
--      åbnes op, beskyttes rolle-felterne stadig.
--
-- Client-side gate (kun admin ser rulle-feltet) er UX; database-laget
-- er der som forsvar mod devtools eller direkte API-calls.
--
-- service_role og postgres omgår begge tjek (de har brug for at kunne
-- bootstrappe og migrere) — de har ikke en auth.uid().

-- ---------------------------------------------------------------------
-- 1. RLS UPDATE-policy: kun admins må opdatere sales via authenticated
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
CREATE POLICY "Admins can update sales"
    ON public.sales
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. BEFORE UPDATE trigger: rolle-felter kan KUN ændres af admin
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
RETURNS trigger AS $$
BEGIN
    -- Ingen auth-kontekst (service_role, postgres, migration): tillad.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ændres et rolle-felt af en ikke-admin: afvis.
    IF (NEW.lago_role IS DISTINCT FROM OLD.lago_role
        OR NEW.administrator IS DISTINCT FROM OLD.administrator)
       AND NOT public.is_admin() THEN
        RAISE EXCEPTION
            'Kun administratorer kan ændre rolle-felter (lago_role, administrator).'
            USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS sales_role_change_guard ON public.sales;
CREATE TRIGGER sales_role_change_guard
    BEFORE UPDATE OF lago_role, administrator ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_role_change_by_admin();
