-- Brief 86 §8-korrektur (28. sep 2026): datakvalitets-widget på ledelsens
-- forside viste summen af fire filtre (28 + 58 + 0 + 89 = 175). En kunde
-- kan være i flere filtre på én gang, så tallet var hverken kunder eller
-- registreringer.
--
-- Widget'en skal vise DISTINKTE kunder med mindst ét hul (målt: 116).
-- Udvider dashboard_datahuller_lago med feltet `distinkte_kunder`, så
-- widget'en kan læse begge tal og forklare forskellen (overlap = 59).

CREATE OR REPLACE FUNCTION public.dashboard_datahuller_lago()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_uden_ejer        int;
    v_uden_kontakt     int;
    v_uden_adresse     int;
    v_uden_segment     int;
    v_distinkte_kunder int;
    v_rows             jsonb;
BEGIN
    SELECT count(*) INTO v_uden_ejer
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND c.sales_id IS NULL;

    SELECT count(*) INTO v_uden_adresse
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND c.address IS NULL;

    SELECT count(*) INTO v_uden_segment
      FROM public.companies_lago cl
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND cl.segment = 'X';

    SELECT count(*) INTO v_uden_kontakt
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
       );

    -- Distinkt-count: UNION over de fire filtre på company_id.
    -- UNION (uden ALL) deduper, så en kunde med tre huller tælles én
    -- gang. Det er tallet Ole skal se: "N kunder mangler oplysninger".
    SELECT count(DISTINCT company_id) INTO v_distinkte_kunder
      FROM (
        SELECT c.id AS company_id
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND c.sales_id IS NULL
        UNION
        SELECT c.id
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND c.address IS NULL
        UNION
        SELECT cl.company_id
          FROM public.companies_lago cl
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND cl.segment = 'X'
        UNION
        SELECT c.id
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
           )
      ) t;

    WITH samples AS (
      SELECT * FROM (
        SELECT c.id, c.name, c.city, 'uden_ejer'::text AS hull_type,
               row_number() OVER (ORDER BY c.name) AS rn
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND c.sales_id IS NULL
      ) s WHERE rn <= 5
      UNION ALL
      SELECT * FROM (
        SELECT c.id, c.name, c.city, 'uden_adresse'::text AS hull_type,
               row_number() OVER (ORDER BY c.name) AS rn
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND c.address IS NULL
      ) s WHERE rn <= 5
      UNION ALL
      SELECT * FROM (
        SELECT c.id, c.name, c.city, 'uden_segment'::text AS hull_type,
               row_number() OVER (ORDER BY c.name) AS rn
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND cl.segment = 'X'
      ) s WHERE rn <= 5
      UNION ALL
      SELECT * FROM (
        SELECT c.id, c.name, c.city, 'uden_kontakt'::text AS hull_type,
               row_number() OVER (ORDER BY c.name) AS rn
          FROM public.companies c
          JOIN public.companies_lago cl ON cl.company_id = c.id
         WHERE cl.is_visible_to_sales = true
           AND cl.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
           )
      ) s WHERE rn <= 5
    )
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'city', city,
          'hull_type', hull_type
        )
      ),
      '[]'::jsonb
    ) INTO v_rows
      FROM samples;

    RETURN jsonb_build_object(
      'counts', jsonb_build_object(
        'uden_ejer',    v_uden_ejer,
        'uden_kontakt', v_uden_kontakt,
        'uden_adresse', v_uden_adresse,
        'uden_segment', v_uden_segment
      ),
      'distinkte_kunder', v_distinkte_kunder,
      'rows', v_rows
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_datahuller_lago() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_datahuller_lago() TO authenticated;
