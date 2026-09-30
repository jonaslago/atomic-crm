-- Brief 64 fase 2 (18. sep 2026) · dashboard_ringeliste_lago bruger
-- customers_with_priority_lago i stedet for at gentage regel.
--
-- Brief §1: to implementeringer af "overdue" (klient + RPC) blev til
-- to endnu efter fase 1 hvis vi lod Ringeliste-RPC beregne selv. Nu
-- er der ÉN kilde til grundstatus (view'et). Ringelisten filtrerer
-- OVENPÅ: overdue + next_visit_planned IS NULL + days_overdue >= 5.
-- De ekstra regler er ringelistens ansvar; grundstatus er view'ets.
--
-- Ingen frontend-ændring — RPC'ens signatur og returværdi er uændret.

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
        vp.days_overdue,
        CASE cl.segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      -- Brief 64 fase 2: grundstatus fra view. Ringelistens ekstra
      -- filtre lægges ovenpå (overdue + planlagt tom + >= 5 dage).
      JOIN public.customers_with_priority_lago vp
        ON vp.company_id = cl.company_id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.next_visit_planned IS NULL
        AND vp.status = 'overdue'
        AND vp.days_overdue >= 5
    ),
    ranked AS (
      SELECT c.*,
             row_number() OVER (
               ORDER BY days_overdue DESC, segment_rank ASC, name ASC
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
            -- interval_days ikke længere en del af RPC'en efter fase 2 —
            -- view'et ejer intervals. Frontend bruger det ikke i
            -- rendering, kun days_overdue.
            'interval_days', NULL
          )
          ORDER BY r.days_overdue DESC, r.segment_rank ASC, r.name ASC
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
