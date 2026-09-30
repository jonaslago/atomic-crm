-- Brief 57 fix (17. sep 2026) · Ringeliste-sortering.
--
-- Første kast (20260920000000) sorterede segment_rank ASC → days_overdue
-- DESC → name. Det er FORKERT: klient-siden bruger
-- comparePriorityThenSegmentThenName, som for same-status (alle overdue)
-- sorterer på sortScore (= days_overdue) DESC FØRST, så segment, så navn.
--
-- Verifikation mod prod bekræftede afvigelsen (Jonas' top-5 =
-- Hotel Harmonien 1082, Holm-Helverskov 1080, Vinoble Bogense 1049,
-- Primo Vino 998, Skjold Burne Gentofte 961 — ren dov-DESC. Min gamle
-- sortering satte alle A-kunder først uanset dov, hvilket puttede
-- Vinoble Bogense på #1 og skubbede de tre 1000+dov-C-kunder ud af
-- top-5).
--
-- Ren ORDER BY-fix. Filter (segment IN A/B/C, last_visit_at NOT NULL,
-- next_visit_planned NULL, dov >= 5) er UÆNDRET, så total (114) forbliver.

CREATE OR REPLACE FUNCTION public.dashboard_ringeliste_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_intervals jsonb;
    v_days_a    int;
    v_days_b    int;
    v_days_c    int;
    v_rows      jsonb;
    v_total     int;
    v_now       timestamptz := now();
BEGIN
    SELECT value INTO v_intervals
      FROM public.lago_settings
     WHERE key = 'visit_intervals';

    v_days_a := coalesce((v_intervals->>'A')::int, 30);
    v_days_b := coalesce((v_intervals->>'B')::int, 60);
    v_days_c := coalesce((v_intervals->>'C')::int, 90);

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
        CASE cl.segment
          WHEN 'A' THEN v_days_a
          WHEN 'B' THEN v_days_b
          WHEN 'C' THEN v_days_c
        END AS interval_days,
        floor(extract(epoch FROM (v_now - cl.last_visit_at)) / 86400)::int
          AS days_since_visit
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.segment IN ('A','B','C')
        AND cl.last_visit_at IS NOT NULL
        AND cl.next_visit_planned IS NULL
    ),
    scored AS (
      SELECT
        id, name, city, sales_id, segment, distrikt, last_visit_at,
        visma_sales_name, interval_days,
        (days_since_visit - interval_days) AS days_overdue,
        CASE segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM candidates
      WHERE (days_since_visit - interval_days) >= 5
    ),
    ranked AS (
      SELECT s.*,
             row_number() OVER (
               -- Rækkefølgen matcher comparePriorityThenSegmentThenName
               -- for same-status: sortScore (days_overdue) DESC → segment
               -- → navn. Ikke segment først (det var forrige versions fejl).
               ORDER BY days_overdue DESC, segment_rank ASC, name ASC
             ) AS rn
      FROM scored s
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
            'interval_days', r.interval_days
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
