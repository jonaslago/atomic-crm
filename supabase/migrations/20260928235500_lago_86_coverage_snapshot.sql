-- Brief 86 §7 (28. sep 2026): coverage_snapshot_lago — dagligt snapshot
-- af dækningsgraden pr. segment.
--
-- Kan ikke regnes bagud. `last_visit_at` kender kun det seneste besøg;
-- hvad dækningsgraden var den 1. september kan ikke rekonstrueres.
-- Kurven er værdiløs i en måned. Umulig at lave om et år, hvis vi ikke
-- begynder i dag. Så: byg tabellen nu, skriv én række om dagen pr.
-- segment, vis den ikke endnu.
--
-- Én række pr. (dato, segment). UPSERT så cron kan køre flere gange
-- samme dag uden dublet-rækker. `refresh_coverage_snapshot()` beregner
-- ud fra samme kilde som kundelistens venstreskinne (customers_with_priority_lago
-- → visit_priority.status). Skriver ROW pr. distinkt segment plus
-- "Uklassificeret" (X, L eller ingen segment).

CREATE TABLE IF NOT EXISTS public.coverage_snapshot_lago (
    dato          date NOT NULL,
    segment       text NOT NULL,
    ajour         int NOT NULL DEFAULT 0,
    traenger      int NOT NULL DEFAULT 0,
    overskredet   int NOT NULL DEFAULT 0,
    i_alt         int NOT NULL DEFAULT 0,
    oprettet      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dato, segment)
);

CREATE INDEX IF NOT EXISTS coverage_snapshot_lago_dato_idx
    ON public.coverage_snapshot_lago (dato DESC);

-- Beregnings-funktion. UPSERT på (dato, segment). SECURITY DEFINER så
-- cron/scheduled task ikke behøver særlige rettigheder.
CREATE OR REPLACE FUNCTION public.refresh_coverage_snapshot(target_dato date DEFAULT CURRENT_DATE)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows int := 0;
BEGIN
    -- Slet-og-genskab for target_dato så en genberegning altid giver
    -- samme svar som en ny insert. Cron kalder én gang om dagen; en
    -- backfill kan kalde for specifikke datoer uden dubletter.
    DELETE FROM public.coverage_snapshot_lago WHERE dato = target_dato;

    INSERT INTO public.coverage_snapshot_lago (dato, segment, ajour, traenger, overskredet, i_alt)
    SELECT
        target_dato,
        COALESCE(segment_bucket, 'Uklassificeret') AS segment,
        COUNT(*) FILTER (WHERE status_bucket = 'on_plan')::int   AS ajour,
        COUNT(*) FILTER (WHERE status_bucket = 'soon')::int      AS traenger,
        COUNT(*) FILTER (WHERE status_bucket IN ('overdue','never_visited'))::int AS overskredet,
        COUNT(*)::int AS i_alt
    FROM (
        SELECT
            CASE
                WHEN cl.segment IN ('A','B','C') THEN cl.segment
                ELSE 'Uklassificeret'
            END AS segment_bucket,
            COALESCE(vp.status, 'no_urgency') AS status_bucket
        FROM public.companies_lago cl
        LEFT JOIN public.customers_with_priority_lago vp
          ON vp.company_id = cl.company_id
        WHERE COALESCE(cl.is_active, true) = true
    ) t
    GROUP BY COALESCE(segment_bucket, 'Uklassificeret');

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_coverage_snapshot(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_coverage_snapshot(date) TO authenticated;

-- RLS: læsning for authenticated (ledelses-widget skal kunne læse), skrivning
-- kun via refresh-funktionen (SECURITY DEFINER).

ALTER TABLE public.coverage_snapshot_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read coverage_snapshot"
    ON public.coverage_snapshot_lago;
CREATE POLICY "Authenticated read coverage_snapshot"
    ON public.coverage_snapshot_lago
    FOR SELECT TO authenticated USING (true);

-- Skriv det første snapshot straks — så kurven begynder nu.
SELECT public.refresh_coverage_snapshot();
