-- §101-4 (1. okt 2026): fourth column "Uden besøgspligt" for segment X.
-- Rows must sum to i_alt (260). no_urgency customers are counted in
-- uden_besoegspligt instead of falling through all three FILTER columns.

DROP FUNCTION IF EXISTS public.coverage_by_segment_status();
CREATE FUNCTION public.coverage_by_segment_status()
RETURNS TABLE (
    segment text,
    ajour int,
    traenger int,
    overskredet int,
    uden_besoegspligt int,
    i_alt int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        segment_bucket AS segment,
        COUNT(*) FILTER (WHERE status_bucket = 'on_plan')::int           AS ajour,
        COUNT(*) FILTER (WHERE status_bucket = 'soon')::int              AS traenger,
        COUNT(*) FILTER (WHERE status_bucket IN ('overdue','never_visited'))::int AS overskredet,
        COUNT(*) FILTER (WHERE status_bucket = 'no_urgency')::int        AS uden_besoegspligt,
        COUNT(*)::int AS i_alt
    FROM (
        SELECT
            CASE WHEN cl.segment IN ('A','B','C') THEN cl.segment ELSE 'Uklassificeret' END AS segment_bucket,
            COALESCE(vp.status, 'no_urgency') AS status_bucket
        FROM public.companies_lago cl
        LEFT JOIN public.customers_with_priority_lago vp
          ON vp.company_id = cl.company_id
        WHERE cl.is_active = true
          AND cl.is_visible_to_sales = true
          AND cl.segment IS NOT NULL
          AND cl.segment <> 'L'
    ) t
    GROUP BY segment_bucket
    ORDER BY
        CASE segment_bucket
            WHEN 'A' THEN 1
            WHEN 'B' THEN 2
            WHEN 'C' THEN 3
            ELSE 4
        END;
$$;
