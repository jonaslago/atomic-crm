-- Brief 86 §7 opfølgning (28. sep 2026): filter-korrektion på
-- refresh_coverage_snapshot så tallene matcher kundelistens venstre-
-- skinne (brief 86 §3's afstemnings-krav). Første version tog alle
-- is_active-kunder inklusive skjulte og leads; venstreskinnen viser
-- kun visible-to-sales, aktive, ikke-L kunder — det er de 260 som
-- Ole ser når han åbner Kunder.
--
-- Uden dette filter viste snapshot 346 (172 uklassificeret bl.a. pga.
-- leads og skjulte); Ole ville ikke kunne sammenligne med Kunder-listen.

CREATE OR REPLACE FUNCTION public.refresh_coverage_snapshot(target_dato date DEFAULT CURRENT_DATE)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows int := 0;
BEGIN
    DELETE FROM public.coverage_snapshot_lago WHERE dato = target_dato;

    INSERT INTO public.coverage_snapshot_lago (dato, segment, ajour, traenger, overskredet, i_alt)
    SELECT
        target_dato,
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
    GROUP BY segment_bucket;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

-- Kør dagens snapshot igen med korrekt filter.
SELECT public.refresh_coverage_snapshot();
