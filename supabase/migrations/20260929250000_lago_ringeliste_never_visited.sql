-- §18 (29. sep 2026): ringelisten skal medtage never_visited-kunderne.
--
-- Målt før fix: forsiden 103, kundelisten 143, min §8b 141 — tre tal for
-- samme begreb. Diff'en 141→103 er de 38 never_visited-kunder som
-- forsidens RPC mangler; diff'en 143→141 er 2 overdue-kunder [5..13] dg
-- som kundelisten stadig fangede (client-fix landet parallelt).
--
-- Én definition på tværs af forside og kundeliste:
--   is_visible_to_sales = true
--   AND is_active = true
--   AND next_visit_planned IS NULL
--   AND (
--     (vp.status = 'overdue' AND vp.days_overdue >= 14)
--     OR vp.status = 'never_visited'
--   )
--
-- Never_visited-grenen har ikke days_overdue (vp.days_overdue er NULL),
-- så sorteringsnøglen falder tilbage på segment_rank + name.

CREATE OR REPLACE FUNCTION public.dashboard_ringeliste_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows      jsonb;
    v_total     int;
BEGIN
    WITH candidates AS (
      SELECT
        c.id,
        c.name,
        c.city,
        c.sales_id,
        cl.segment,
        cl.distrikt,
        cl.last_visit_at,
        cl.visma_sales_name,
        cl.besoegsfrekvens_note,
        vp.status,
        vp.days_overdue,
        CASE cl.segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp
        ON vp.company_id = cl.company_id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.next_visit_planned IS NULL
        AND (
          (vp.status = 'overdue' AND vp.days_overdue >= 14)
          OR vp.status = 'never_visited'
        )
    ),
    ranked AS (
      SELECT c.*,
             row_number() OVER (
               -- Never_visited (days_overdue NULL) sorteres NULLS LAST
               -- så overdue-kunderne med højeste dage kommer først.
               ORDER BY days_overdue DESC NULLS LAST,
                        segment_rank ASC,
                        name ASC
             ) AS rn
      FROM candidates c
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'city', r.city,
            'sales_id', r.sales_id,
            'segment', r.segment,
            'distrikt', r.distrikt,
            'last_visit_at', r.last_visit_at,
            'visma_sales_name', r.visma_sales_name,
            'days_overdue', r.days_overdue,
            'interval_days', NULL,
            'besoegsfrekvens_note', r.besoegsfrekvens_note,
            'status', r.status
          )
          ORDER BY r.days_overdue DESC NULLS LAST,
                   r.segment_rank ASC,
                   r.name ASC
        ) FILTER (WHERE r.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int
    INTO v_rows, v_total
    FROM ranked r;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ringeliste_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_ringeliste_lago(int) TO authenticated;
