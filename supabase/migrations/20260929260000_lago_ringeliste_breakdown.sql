-- §18 opfølgning (29. sep 2026): tælleren skal vise fordelingen
-- overdue vs never_visited. Simon skal se hvad han står med — de to
-- grupper kræver forskellige samtaler:
--   overdue      "jeg har ikke været forbi længe"
--   never_visited "vi har aldrig talt sammen"
--
-- Ændring fra 20260929250000: payload udvidet med total_overdue og
-- total_never_visited så widget'et kan vise "141 · 103 overskredet · 38
-- aldrig besøgt" uden ekstra kald.

CREATE OR REPLACE FUNCTION public.dashboard_ringeliste_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows              jsonb;
    v_total             int;
    v_total_overdue     int;
    v_total_never       int;
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
      count(*)::int,
      count(*) FILTER (WHERE r.status = 'overdue')::int,
      count(*) FILTER (WHERE r.status = 'never_visited')::int
    INTO v_rows, v_total, v_total_overdue, v_total_never
    FROM ranked r;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total,
      'total_overdue', v_total_overdue,
      'total_never_visited', v_total_never
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ringeliste_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_ringeliste_lago(int) TO authenticated;
