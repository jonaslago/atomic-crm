-- Brief 57 (17. sep 2026) · Dashboard-RPC'er for at fjerne ubegrænsede
-- kald fra forsiden.
--
-- Baggrund: forsiden affyrede på kold indlæsning:
--   1) contacts?select=company_id                — hele contacts-tabellen
--   2) companies?select=...is_visible_to_sales    — hele companies (~950)
--   3) companies?...&limit=5000 × 2               — Ringelisten + duplet
--
-- Desktop kunne tåle det; iPhone kunne ikke. Fix: server-side RPC'er der
-- laver tællingerne og filtreringerne i basen og returnerer 5-20 rows
-- pr. widget i stedet for 1000-5000. Rows-over-wire på forsiden falder
-- fra ~7000+ til <100.

-- 1) Datahuller-widget ----------------------------------------------------
--
-- Erstatter fire separate .select(count:'exact')-kald + hele contacts-
-- tabellen + hele companies-tabellen med ét RPC-kald der returnerer:
--   { counts: {uden_ejer, uden_kontakt, uden_adresse, uden_segment},
--     rows:   [{id, name, city, hull_type}]  (op til 5 pr. type = 20) }
--
-- Rows-over-wire: ~20 (var ~1000+).
--
-- Filtre er identiske med DatahullerWidget.tsx (tillæg 26A + regression
-- 16. sep 2026): is_visible_to_sales=true OG is_active=true på ALLE fire
-- hul-typer, så vi ikke tæller interne konti eller inaktive kunder.

CREATE OR REPLACE FUNCTION public.dashboard_datahuller_lago()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_uden_ejer     int;
    v_uden_kontakt  int;
    v_uden_adresse  int;
    v_uden_segment  int;
    v_rows          jsonb;
BEGIN
    -- Tællinger. count(*) på filtrerede sub-queries — INGEN rows fylder
    -- vores retur.
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

    -- uden_kontakt: sælgersynlige aktive kunder uden nogen kontakt-række.
    -- NOT EXISTS er langt hurtigere serverside end at hente hele
    -- contacts-tabellen ned og lave client-side diff (nuværende widget).
    SELECT count(*) INTO v_uden_kontakt
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
       );

    -- Sample-rows: op til 5 pr. hul-type, sorteret på navn.
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
      'rows', v_rows
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_datahuller_lago() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_datahuller_lago() TO authenticated;

-- 2) Ringeliste-widget ----------------------------------------------------
--
-- Erstatter Ringelisten's fetchCustomerList({}) — som hentede op til 5000
-- rækker (companies + companies_lago-embed) og lavede overdue-beregningen
-- klient-side.
--
-- RPC'en gør det samme serverside:
--   - Læser visit_intervals fra lago_settings (fallback: A=30, B=60, C=90)
--   - Beregner daysOverdue = floor((now - last_visit_at) / 1 day) - interval
--   - Filtrerer: status='overdue' AND next_visit_planned IS NULL
--                AND daysOverdue >= 5 (DAG_5_FALLBACK)
--   - Sorterer: segment-urgency (A→B→C) → daysOverdue DESC → navn
--   - LIMIT p_limit (default 20 — CLIP_TO=5 vises, resten til "Se alle N")
--
-- Returnerer også total_count så widget'en kan vise "Se alle N →" uden
-- et andet kald.
--
-- Rows-over-wire: op til 20 (var op til 5000).

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
    -- Intervals fra lago_settings; fallback til compile-time defaults
    -- (samme værdier som src/lago/customers/segmentIntervals.ts).
    SELECT value INTO v_intervals
      FROM public.lago_settings
     WHERE key = 'visit_intervals';

    v_days_a := coalesce((v_intervals->>'A')::int, 30);
    v_days_b := coalesce((v_intervals->>'B')::int, 60);
    v_days_c := coalesce((v_intervals->>'C')::int, 90);

    -- CTE med kandidat-rækker: sælger-synlige, aktive, A/B/C-kunder med
    -- last_visit_at sat, uden fremtidig planlagt aftale, og hvor
    -- daysOverdue >= 5.
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
        cl.next_visit_planned,
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
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'city', s.city,
            'sales_id', s.sales_id,
            'segment', s.segment,
            'distrikt', s.distrikt,
            'last_visit_at', s.last_visit_at,
            'visma_sales_name', s.visma_sales_name,
            'days_overdue', s.days_overdue,
            'interval_days', s.interval_days
          )
          ORDER BY s.segment_rank ASC, s.days_overdue DESC, s.name ASC
        ) FILTER (WHERE s.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int
    INTO v_rows, v_total
    FROM (
      SELECT s.*,
             row_number() OVER (
               ORDER BY segment_rank ASC, days_overdue DESC, name ASC
             ) AS rn
      FROM scored s
    ) s;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ringeliste_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_ringeliste_lago(int) TO authenticated;
