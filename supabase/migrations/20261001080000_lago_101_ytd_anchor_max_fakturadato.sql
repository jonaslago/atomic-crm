-- §101-1 fix (1. okt 2026): ÅTD anchor = MAX(fakturadato), not current_date.
--
-- LAGO invoices only in the morning. Today's numbers are either not in
-- yet or complete — they don't fill up gradually. The anchor must be the
-- last date we actually have data for, not the clock.
--
-- Same anchor minus one year on last year's side.
--
-- The anchor date is exposed as `aatd_anchor` so the widget can show
-- "År til dato pr. <dato>, mod samme dato sidste år."

-- 1. v_sales_customer_periods
CREATE OR REPLACE VIEW public.v_sales_customer_periods AS
WITH customer_sales AS (
    SELECT
        s.visma_customer_no,
        s.fakturadato AS dato,
        make_date(s.aar::int, s.maaned::int, 1) AS maaned_periode,
        s.belob
      FROM public.sales_monthly_lago s
),
ref AS (
    SELECT
        MAX(maaned_periode) AS ref_month,
        MAX(dato)           AS anchor
      FROM customer_sales
    HAVING MAX(maaned_periode) IS NOT NULL
),
periods AS (
    SELECT
        ref_month,
        anchor,
        -- T12M (month-based)
        (ref_month - INTERVAL '11 months')::date AS t12m_from,
        ref_month                                AS t12m_to,
        (ref_month - INTERVAL '23 months')::date AS t12m_prev_from,
        (ref_month - INTERVAL '12 months')::date AS t12m_prev_to,
        -- ÅTD: day-based, anchor = MAX(fakturadato)
        DATE_TRUNC('year', anchor)::date         AS aatd_from,
        anchor                                   AS aatd_to,
        (DATE_TRUNC('year', anchor) - INTERVAL '1 year')::date AS aatd_prev_from,
        (anchor - INTERVAL '1 year')::date       AS aatd_prev_to,
        -- 3M (month-based)
        (ref_month - INTERVAL '2 months')::date  AS seneste_3m_from,
        ref_month                                AS seneste_3m_to,
        (ref_month - INTERVAL '5 months')::date  AS seneste_3m_prev_from,
        (ref_month - INTERVAL '3 months')::date  AS seneste_3m_prev_to,
        -- Hele sidste år
        DATE_TRUNC('year', ref_month - INTERVAL '1 year')::date AS hele_sidste_aar_from,
        (DATE_TRUNC('year', ref_month) - INTERVAL '1 day')::date AS hele_sidste_aar_to
      FROM ref
),
aggregated AS (
    SELECT
        cs.visma_customer_no,
        SUM(CASE WHEN cs.maaned_periode BETWEEN p.t12m_from      AND p.t12m_to      THEN cs.belob ELSE 0 END) AS t12m,
        SUM(CASE WHEN cs.maaned_periode BETWEEN p.t12m_prev_from AND p.t12m_prev_to THEN cs.belob ELSE 0 END) AS t12m_forrige,
        SUM(CASE WHEN cs.dato BETWEEN p.aatd_from      AND p.aatd_to      THEN cs.belob ELSE 0 END) AS aatd,
        SUM(CASE WHEN cs.dato BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN cs.belob ELSE 0 END) AS aatd_sidste_aar,
        SUM(CASE WHEN cs.maaned_periode BETWEEN p.seneste_3m_from      AND p.seneste_3m_to      THEN cs.belob ELSE 0 END) AS seneste_3m,
        SUM(CASE WHEN cs.maaned_periode BETWEEN p.seneste_3m_prev_from AND p.seneste_3m_prev_to THEN cs.belob ELSE 0 END) AS seneste_3m_forrige,
        SUM(CASE WHEN cs.maaned_periode BETWEEN p.hele_sidste_aar_from AND p.hele_sidste_aar_to THEN cs.belob ELSE 0 END) AS hele_sidste_aar
      FROM customer_sales cs
      CROSS JOIN periods p
     GROUP BY cs.visma_customer_no
)
SELECT
    a.visma_customer_no,
    c.id AS company_id,
    c.name AS kunde,
    cl.distrikt,
    cl.segment,
    cl.kundetype,
    cl.visma_sales_name,
    a.t12m,
    a.t12m_forrige,
    a.aatd,
    a.aatd_sidste_aar,
    a.seneste_3m,
    a.seneste_3m_forrige,
    a.hele_sidste_aar,
    (a.aatd - a.aatd_sidste_aar) AS aatd_vaekst_kr,
    ROUND(((a.aatd - a.aatd_sidste_aar) / NULLIF(a.aatd_sidste_aar, 0)) * 100, 1) AS aatd_vaekst_pct,
    (a.seneste_3m - a.seneste_3m_forrige) AS seneste_3m_vaekst_kr,
    ROUND(((a.seneste_3m - a.seneste_3m_forrige) / NULLIF(a.seneste_3m_forrige, 0)) * 100, 1) AS seneste_3m_vaekst_pct
  FROM aggregated a
  LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = a.visma_customer_no
  LEFT JOIN public.companies      c  ON c.id = cl.company_id;

-- 2. v_sales_district_periods
CREATE OR REPLACE VIEW public.v_sales_district_periods AS
WITH customer_sales AS (
    SELECT
        s.fakturadato AS dato,
        make_date(s.aar::int, s.maaned::int, 1) AS maaned_periode,
        s.belob,
        cl.distrikt,
        cl.kundetype
      FROM public.sales_monthly_lago s
      LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = s.visma_customer_no
),
ref AS (
    SELECT
        MAX(maaned_periode) AS ref_month,
        MAX(dato)           AS anchor
      FROM customer_sales
    HAVING MAX(maaned_periode) IS NOT NULL
),
periods AS (
    SELECT
        ref_month,
        anchor,
        (ref_month - INTERVAL '11 months')::date AS t12m_from,
        ref_month                                AS t12m_to,
        (ref_month - INTERVAL '23 months')::date AS t12m_prev_from,
        (ref_month - INTERVAL '12 months')::date AS t12m_prev_to,
        DATE_TRUNC('year', anchor)::date         AS aatd_from,
        anchor                                   AS aatd_to,
        (DATE_TRUNC('year', anchor) - INTERVAL '1 year')::date AS aatd_prev_from,
        (anchor - INTERVAL '1 year')::date       AS aatd_prev_to,
        (ref_month - INTERVAL '2 months')::date  AS seneste_3m_from,
        ref_month                                AS seneste_3m_to,
        (ref_month - INTERVAL '5 months')::date  AS seneste_3m_prev_from,
        (ref_month - INTERVAL '3 months')::date  AS seneste_3m_prev_to
      FROM ref
)
SELECT
    swd.distrikt,
    swd.kundetype,
    GROUPING(swd.distrikt, swd.kundetype) AS grouping_id,
    SUM(CASE WHEN swd.maaned_periode BETWEEN p.t12m_from      AND p.t12m_to      THEN swd.belob ELSE 0 END) AS t12m,
    SUM(CASE WHEN swd.maaned_periode BETWEEN p.t12m_prev_from AND p.t12m_prev_to THEN swd.belob ELSE 0 END) AS t12m_forrige,
    SUM(CASE WHEN swd.dato BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END) AS aatd,
    SUM(CASE WHEN swd.dato BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END) AS aatd_sidste_aar,
    SUM(CASE WHEN swd.maaned_periode BETWEEN p.seneste_3m_from      AND p.seneste_3m_to      THEN swd.belob ELSE 0 END) AS seneste_3m,
    SUM(CASE WHEN swd.maaned_periode BETWEEN p.seneste_3m_prev_from AND p.seneste_3m_prev_to THEN swd.belob ELSE 0 END) AS seneste_3m_forrige,
    (SUM(CASE WHEN swd.dato BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END)
     - SUM(CASE WHEN swd.dato BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END)) AS aatd_vaekst_kr,
    ROUND(
        ((SUM(CASE WHEN swd.dato BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END)
          - SUM(CASE WHEN swd.dato BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END))
         / NULLIF(SUM(CASE WHEN swd.dato BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END), 0))
        * 100, 1
    ) AS aatd_vaekst_pct,
    -- Expose anchor so the widget can display "pr. <dato>"
    MAX(p.anchor) AS aatd_anchor
  FROM customer_sales swd
  CROSS JOIN periods p
 GROUP BY GROUPING SETS (
    (swd.distrikt, swd.kundetype),
    (swd.distrikt),
    ()
 )
HAVING GROUPING(swd.distrikt, swd.kundetype) IN (0, 1, 3);

-- 3. sales_ytd_for_customer RPC
CREATE OR REPLACE FUNCTION public.sales_ytd_for_customer(
    p_customer_no text,
    p_current_year int,
    p_last_year int,
    p_through_month int
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH anchor AS (
    SELECT COALESCE(MAX(fakturadato), current_date) AS d
    FROM sales_monthly_lago
    WHERE visma_customer_no = p_customer_no
      AND aar = p_current_year
  )
  SELECT jsonb_build_object(
    'ytd_this_year', COALESCE((
      SELECT SUM(belob) FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
        AND fakturadato BETWEEN make_date(p_current_year, 1, 1) AND (SELECT d FROM anchor)
    ), 0),
    'ytd_last_year', COALESCE((
      SELECT SUM(belob) FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
        AND fakturadato BETWEEN make_date(p_last_year, 1, 1)
                             AND ((SELECT d FROM anchor) - INTERVAL '1 year')::date
    ), 0),
    'has_any_history', EXISTS (
      SELECT 1 FROM sales_monthly_lago
      WHERE visma_customer_no = p_customer_no
      LIMIT 1
    ),
    'anchor_date', (SELECT d FROM anchor)
  );
$$;

GRANT SELECT ON public.v_sales_customer_periods TO authenticated;
GRANT SELECT ON public.v_sales_district_periods TO authenticated;
