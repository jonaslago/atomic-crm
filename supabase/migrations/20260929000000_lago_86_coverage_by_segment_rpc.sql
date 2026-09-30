-- Brief 86 §3+§12 (28. sep 2026): live-udregning af segment × status til
-- ledelsens Dækningsgraden-widget. Skal stemme med kundelistens venstre-
-- skinne HELE dagen — hvis vi læser fra coverage_snapshot_lago drifter
-- den fra venstreskinnen så snart et besøg registreres.
--
-- Samme filter og buckets som refresh_coverage_snapshot: aktive, synlige
-- for salg, ikke L. Status-mapping: on_plan → ajour, soon → trænger,
-- overdue/never_visited → overskredet. Kunder uden priority-record (no_urgency)
-- havner i i_alt men i ingen af de tre status-tællinger — samme opførsel
-- som snapshottet.

CREATE OR REPLACE FUNCTION public.coverage_by_segment_status()
RETURNS TABLE (
    segment     text,
    ajour       int,
    traenger    int,
    overskredet int,
    i_alt       int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        segment_bucket AS segment,
        COUNT(*) FILTER (WHERE status_bucket = 'on_plan')::int   AS ajour,
        COUNT(*) FILTER (WHERE status_bucket = 'soon')::int      AS traenger,
        COUNT(*) FILTER (WHERE status_bucket IN ('overdue','never_visited'))::int AS overskredet,
        COUNT(*)::int AS i_alt
    FROM (
        SELECT
            CASE WHEN cl.segment IN ('A','B','C') THEN cl.segment ELSE 'Uklassificeret' END AS segment_bucket,
            COALESCE(vp.status, 'no_urgency') AS status_bucket
        FROM public.companies_lago cl
        LEFT JOIN public.customers_with_priority_lago vp
          ON vp.company_id = cl.company_id
        WHERE COALESCE(cl.is_active, true) = true
          AND COALESCE(cl.is_visible_to_sales, true) = true
          AND (cl.segment IS NULL OR cl.segment <> 'L')
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

REVOKE ALL ON FUNCTION public.coverage_by_segment_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coverage_by_segment_status() TO authenticated;
