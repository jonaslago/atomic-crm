-- Brief (16. sep 2026): blød sletning + auto-genberegning af last_visit_at.
--
-- Kernen: en sælger skal kunne slette en CRM-oprettet aktivitet (fx et
-- fejltryk på "Marker besøgt"), OG last_visit_at skal følge med. Uden
-- den kobling genskaber vi præcis fejlen vi lige rettede — bare fra
-- den anden ende: kunden står som besøgt på grundlag af en aktivitet,
-- der ikke længere findes.
--
-- Tre stykker:
--
--   1) `deleted_at timestamptz` på customer_activities_lago (nullable).
--      Blød sletning — intet er reelt tabt hvis nogen fortryder sin
--      fortrydelse.
--
--   2) `soft_delete_customer_activity(id, undo)` RPC. Klienten kalder
--      denne i stedet for at UPDATE-e deleted_at direkte. Server-side
--      håndhævelse af de tre regler:
--        - kun source='crm_native' (VISMA-historik røres ikke)
--        - kun egen aktivitet, eller admin
--        - idempotent på undo (undo=true → deleted_at=NULL)
--
--   3) Trigger der genberegner companies_lago.last_visit_at fra
--      MAX(activity_date) WHERE activity_type_code=1 AND deleted_at IS NULL.
--      Kører ved INSERT, UPDATE og DELETE. Nu er last_visit_at en
--      database-invariant, ikke noget klienten skal huske at bumpe.

-- 1) Kolonne
ALTER TABLE public.customer_activities_lago
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Filter-index så visninger der ekskluderer slettede stadig kan skanne
-- kun de aktive rækker.
CREATE INDEX IF NOT EXISTS customer_activities_lago_active_company_date_idx
    ON public.customer_activities_lago (company_id, activity_date DESC)
    WHERE deleted_at IS NULL;

-- 2) RPC
CREATE OR REPLACE FUNCTION public.soft_delete_customer_activity(
    activity_id bigint,
    undo boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity RECORD;
    v_sales_id bigint;
    v_is_admin boolean;
BEGIN
    SELECT company_id, source, sales_id
      INTO v_activity
      FROM public.customer_activities_lago
     WHERE id = activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktivitet % findes ikke', activity_id;
    END IF;

    IF v_activity.source IS DISTINCT FROM 'crm_native' THEN
        RAISE EXCEPTION 'Kun CRM-oprettede aktiviteter kan slettes (source=%)',
            v_activity.source;
    END IF;

    SELECT id, administrator
      INTO v_sales_id, v_is_admin
      FROM public.sales
     WHERE user_id = auth.uid();

    IF v_sales_id IS NULL THEN
        RAISE EXCEPTION 'Brugeren har ingen sales-profil';
    END IF;

    IF NOT COALESCE(v_is_admin, false)
       AND v_activity.sales_id IS DISTINCT FROM v_sales_id THEN
        RAISE EXCEPTION 'Kun ejeren eller admin kan slette denne aktivitet';
    END IF;

    IF undo THEN
        UPDATE public.customer_activities_lago
           SET deleted_at = NULL,
               updated_at = now()
         WHERE id = activity_id;
    ELSE
        UPDATE public.customer_activities_lago
           SET deleted_at = now(),
               updated_at = now()
         WHERE id = activity_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_customer_activity(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_customer_activity(bigint, boolean)
    TO authenticated;

-- 3) Trigger
CREATE OR REPLACE FUNCTION public.trg_recompute_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id bigint;
    v_max_date date;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_company_id := OLD.company_id;
    ELSE
        v_company_id := NEW.company_id;
    END IF;

    -- Kun besøgs-aktiviteter (type-kode 1) tæller ind i last_visit_at.
    -- Andre aktivitetstyper (opkald, mails osv.) er ikke besøg.
    SELECT MAX(a.activity_date)
      INTO v_max_date
      FROM public.customer_activities_lago a
     WHERE a.company_id = v_company_id
       AND a.activity_type_code = 1
       AND a.deleted_at IS NULL;

    UPDATE public.companies_lago cl
       SET last_visit_at = CASE
               WHEN v_max_date IS NULL THEN NULL
               ELSE (v_max_date::text || ' 12:00:00+00')::timestamptz
           END,
           updated_at = now()
     WHERE cl.company_id = v_company_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS customer_activities_lago_recompute_last_visit_at
    ON public.customer_activities_lago;
CREATE TRIGGER customer_activities_lago_recompute_last_visit_at
    AFTER INSERT OR UPDATE OR DELETE
    ON public.customer_activities_lago
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_recompute_last_visit_at();

-- Genberegn last_visit_at én gang for alle kunder så den nye invariant
-- gælder fra start. Efter denne linje skal ingen UPDATE af last_visit_at
-- ske klient-side — triggeren ejer feltet.
UPDATE public.companies_lago cl
   SET last_visit_at = sub.new_last_visit_at,
       updated_at = now()
  FROM (
      SELECT c.company_id,
             CASE
                 WHEN MAX(a.activity_date) IS NULL THEN NULL
                 ELSE (MAX(a.activity_date)::text || ' 12:00:00+00')::timestamptz
             END AS new_last_visit_at
        FROM public.companies_lago c
        LEFT JOIN public.customer_activities_lago a
          ON a.company_id = c.company_id
         AND a.activity_type_code = 1
         AND a.deleted_at IS NULL
       GROUP BY c.company_id
  ) sub
 WHERE cl.company_id = sub.company_id
   AND cl.last_visit_at IS DISTINCT FROM sub.new_last_visit_at;
