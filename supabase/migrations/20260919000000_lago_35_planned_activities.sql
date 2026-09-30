-- Brief 35 (16. sep 2026): planlagte aktiviteter.
--
-- Fremtidige rækker gemmes nu med done=false, og en "Markér som
-- afholdt"-flow flipper flaget når begivenheden har fundet sted. Det
-- betyder, at trg_recompute_last_visit_at ikke længere kan stole på,
-- at hver besøgs-række er en afholdt begivenhed — en planlagt smagning
-- eller (efter en tastefejl, en migrering, en genindlæsning) en
-- fremtidig besøgs-række må ikke skubbe last_visit_at ud i fremtiden.
--
-- Reglen fra brief 35 §3: last_visit_at følger kun rækker der er
-- afholdt (done=true) og som ligger i dag eller tidligere. Den ekstra
-- betingelse ændrer ingenting i dag, fordi UI'et allerede afviser
-- fremtidige besøg — men det er netop pointen: en invariant, der kun
-- gælder fordi ingen har gjort det forkerte endnu, er ikke en invariant.

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

    -- Kun besøgs-aktiviteter (type-kode 1) der er afholdt (done=true)
    -- og som ligger i dag eller tidligere, tæller ind i last_visit_at.
    -- Uden done+dato-filteret kunne en planlagt fremtidig besøgs-række
    -- (eller en fejlimport) sætte last_visit_at ud i fremtiden, og så
    -- ville "dage siden" bliver negativ og hele prioriterings-modellen
    -- ville falde. Brief 35 §3.
    SELECT MAX(a.activity_date)
      INTO v_max_date
      FROM public.customer_activities_lago a
     WHERE a.company_id = v_company_id
       AND a.activity_type_code = 1
       AND a.deleted_at IS NULL
       AND a.done = true
       AND a.activity_date <= current_date;

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

-- Genberegn last_visit_at én gang for alle kunder så den strammede
-- invariant gælder fra start. Kun rækker der matcher den nye betingelse
-- tæller — kunder uden nogen afholdt besøgs-række i dag/tidligere
-- får last_visit_at nulstillet, hvilket er den korrekte tilstand
-- (aldrig besøgt indtil noget er afholdt).
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
         AND a.done = true
         AND a.activity_date <= current_date
       GROUP BY c.company_id
  ) sub
 WHERE cl.company_id = sub.company_id
   AND cl.last_visit_at IS DISTINCT FROM sub.new_last_visit_at;


-- Markér-som-afholdt RPC (brief 35 §4). Klienten kalder denne i stedet
-- for en direkte UPDATE så samme rettighedsmodel som soft-delete gælder:
--   - kun source='crm_native'
--   - kun ejer eller admin må flippe flaget
--   - datoen kan rettes i samme kald (hvis begivenheden skete en anden
--     dag end oprindeligt planlagt — der oprettes ikke en ny række)
--
-- Ingen invers "markér som ikke-afholdt" — det ville dublere sletning.
-- Vil sælgeren fortryde, kan han slette aktiviteten og oprette den på ny.
CREATE OR REPLACE FUNCTION public.mark_activity_done(
    activity_id bigint,
    new_date date DEFAULT NULL
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
    SELECT company_id, source, sales_id, activity_date, done
      INTO v_activity
      FROM public.customer_activities_lago
     WHERE id = activity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aktivitet % findes ikke', activity_id;
    END IF;

    IF v_activity.source IS DISTINCT FROM 'crm_native' THEN
        RAISE EXCEPTION 'Kun CRM-oprettede aktiviteter kan markeres afholdt (source=%)',
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
        RAISE EXCEPTION 'Kun ejeren eller admin kan markere denne aktivitet afholdt';
    END IF;

    -- new_date>=today ville i praksis lade sælgeren "markere afholdt"
    -- på en fremtidig dato, hvilket ville lade rækken se afholdt-ud
    -- uden at være det. Håndhæv at markering altid lander i dag eller
    -- tidligere; hvis intet er angivet, brug dagens dato.
    IF new_date IS NOT NULL AND new_date > current_date THEN
        RAISE EXCEPTION 'Afholdt-dato kan ikke ligge i fremtiden (%)', new_date;
    END IF;

    UPDATE public.customer_activities_lago
       SET done = true,
           activity_date = COALESCE(new_date, current_date),
           updated_at = now()
     WHERE id = activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_activity_done(bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_activity_done(bigint, date)
    TO authenticated;
