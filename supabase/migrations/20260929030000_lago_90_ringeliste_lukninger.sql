-- Brief 90 §2 (28. sep 2026): ringeliste-poster kan lukkes med en
-- begrundelse. BO-13's princip, og det er Simons eget workaround i
-- VISMA (Ordrestatus 22 Særlige, 150 linjer pr. 15. sep).
--
-- Uden det står de samme kunder der igen næste uge, han forklarer dem
-- forfra, og efter tredje gang holder han op med at kigge.
--
-- Auto-luk-regel: en lukning står ved magt indtil noget REELT ændrer sig:
--   1. Et besøg — companies_lago.last_visit_at er nyere end lukket_at
--   2. En ordre — open_orders_lago.synced_at ikke tjekket i denne runde
--      (VISMA-import sætter alle rows til samme timestamp, så tegnet
--      går tabt). Kommer i tillæg når vi har per-ordre-created-timestamps.
--   3. Ny overskridelse — days_overdue er +14 dage større end ved
--      lukning (dvs. der er gået en hel interval-runde ud over den
--      forrige overskridelse)
--
-- Kolonner ved lukning:
--   last_visit_at_ved_lukning  — kopi så vi kan sammenligne "har hun
--                                 fået besøg siden"
--   days_overdue_ved_lukning   — udgangspunkt for "+14 dage"-reglen
--
-- View'et v_active_ringeliste_lukninger_lago returnerer alle lukninger
-- der stadig er gyldige. Bruges af dashboard_ringeliste_lago (forside)
-- og af kundelistens ringeliste-filter (frontend).

CREATE TABLE IF NOT EXISTS public.ringeliste_lukninger_lago (
    id                          bigserial PRIMARY KEY,
    company_id                  bigint NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lukket_af                   bigint REFERENCES public.sales(id) ON DELETE SET NULL,
    lukket_at                   timestamptz NOT NULL DEFAULT now(),
    begrundelse                 text NOT NULL CHECK (length(trim(begrundelse)) > 0),
    last_visit_at_ved_lukning   timestamptz,
    days_overdue_ved_lukning    int,
    -- Manuel annullering — hvis Simon senere ombestemmer sig eller
    -- lukkede forkert. Fælles semantik med andre annullerbare rækker.
    annulleret_at               timestamptz,
    annulleret_af               bigint REFERENCES public.sales(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ringeliste_lukninger_lago_company_idx
    ON public.ringeliste_lukninger_lago (company_id)
    WHERE annulleret_at IS NULL;
CREATE INDEX IF NOT EXISTS ringeliste_lukninger_lago_lukket_idx
    ON public.ringeliste_lukninger_lago (lukket_at DESC);

COMMENT ON TABLE public.ringeliste_lukninger_lago IS
'Brief 90 §2 (28. sep 2026): kontor kan lukke en ringeliste-post med begrundelse. Posten forsvinder fra listen indtil et besøg, en ordre eller +14 dages ny overskridelse trigger auto-genåbning.';

ALTER TABLE public.ringeliste_lukninger_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago;
CREATE POLICY "Authenticated read ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago;
CREATE POLICY "Authenticated insert ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago;
CREATE POLICY "Authenticated update ringeliste_lukninger"
    ON public.ringeliste_lukninger_lago
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- View: seneste aktive lukning pr. kunde. Auto-luk-reglen sidder her,
-- så alle læsere ser samme sandhed.
CREATE OR REPLACE VIEW public.v_active_ringeliste_lukninger_lago AS
WITH ranked AS (
    SELECT
        rl.*,
        cl.last_visit_at   AS current_last_visit_at,
        vp.days_overdue    AS current_days_overdue,
        row_number() OVER (
            PARTITION BY rl.company_id
            ORDER BY rl.lukket_at DESC
        ) AS rn
    FROM public.ringeliste_lukninger_lago rl
    JOIN public.companies_lago cl ON cl.company_id = rl.company_id
    LEFT JOIN public.customers_with_priority_lago vp
      ON vp.company_id = rl.company_id
    WHERE rl.annulleret_at IS NULL
)
SELECT
    r.id,
    r.company_id,
    r.lukket_af,
    r.lukket_at,
    r.begrundelse,
    r.last_visit_at_ved_lukning,
    r.days_overdue_ved_lukning,
    r.current_last_visit_at,
    r.current_days_overdue
FROM ranked r
WHERE r.rn = 1
  -- Regel 1: hvis besøg siden — lukning ophørt
  AND (
    r.current_last_visit_at IS NULL
    OR r.last_visit_at_ved_lukning IS NULL
    OR r.current_last_visit_at <= r.last_visit_at_ved_lukning
  )
  -- Regel 3: hvis +14 dages ny overskridelse — lukning ophørt
  AND (
    r.current_days_overdue IS NULL
    OR r.days_overdue_ved_lukning IS NULL
    OR r.current_days_overdue < r.days_overdue_ved_lukning + 14
  );

COMMENT ON VIEW public.v_active_ringeliste_lukninger_lago IS
'Brief 90 §2 (28. sep 2026): aktive ringeliste-lukninger. En lukning ophører automatisk hvis (a) kunden har fået besøg siden, eller (b) days_overdue er steget +14 dage siden lukningen.';

GRANT SELECT ON public.v_active_ringeliste_lukninger_lago TO authenticated;

-- Opdatér dashboard_ringeliste_lago til at udelukke aktive lukninger.
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
        vp.days_overdue,
        CASE cl.segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp
        ON vp.company_id = cl.company_id
      LEFT JOIN public.v_active_ringeliste_lukninger_lago rl
        ON rl.company_id = c.id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.next_visit_planned IS NULL
        AND vp.status = 'overdue'
        AND vp.days_overdue >= 14
        AND rl.id IS NULL
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
            'interval_days', NULL,
            'besoegsfrekvens_note', r.besoegsfrekvens_note
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
