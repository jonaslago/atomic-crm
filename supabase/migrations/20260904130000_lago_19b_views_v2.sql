-- LAGO Domain-brief 19b — views v2.
--
-- Genskaber de 3 eksisterende sales-views efter schema-ændringen
-- (salgstype tilføjet til sales_monthly_lago's PK), og tilføjer en ny
-- view v_open_orders_categorised der udleder kategori fra de rå felter
-- (aldrig som gemt kolonne — regeljustering kræver ikke reimport).
--
-- Tom tabel → alle views returnerer 0 rækker uden fejl (samme mønster
-- som i 20260902140000).

-- ---------------------------------------------------------------------
-- v_sales_customer_periods
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_sales_customer_periods AS
WITH ref AS (
    SELECT MAX(make_date(aar::int, maaned::int, 1)) AS ref_month
      FROM public.sales_monthly_lago
    HAVING MAX(make_date(aar::int, maaned::int, 1)) IS NOT NULL
),
periods AS (
    SELECT
        ref_month,
        (ref_month - INTERVAL '11 months')::date AS t12m_from,
        ref_month                                AS t12m_to,
        (ref_month - INTERVAL '23 months')::date AS t12m_prev_from,
        (ref_month - INTERVAL '12 months')::date AS t12m_prev_to,
        DATE_TRUNC('year', ref_month)::date      AS aatd_from,
        ref_month                                AS aatd_to,
        (DATE_TRUNC('year', ref_month) - INTERVAL '1 year')::date AS aatd_prev_from,
        (ref_month - INTERVAL '1 year')::date    AS aatd_prev_to,
        (ref_month - INTERVAL '2 months')::date  AS seneste_3m_from,
        ref_month                                AS seneste_3m_to,
        (ref_month - INTERVAL '5 months')::date  AS seneste_3m_prev_from,
        (ref_month - INTERVAL '3 months')::date  AS seneste_3m_prev_to,
        DATE_TRUNC('year', ref_month - INTERVAL '1 year')::date AS hele_sidste_aar_from,
        (DATE_TRUNC('year', ref_month) - INTERVAL '1 day')::date AS hele_sidste_aar_to
      FROM ref
),
-- Salgstype-agnostisk: SUM aggregerer på tværs. FRIFL/PROMO/PRØVE
-- er 0 kr. og forstyrrer ikke omsætnings-tal.
customer_sales AS (
    SELECT
        s.visma_customer_no,
        make_date(s.aar::int, s.maaned::int, 1) AS periode,
        s.belob
      FROM public.sales_monthly_lago s
),
aggregated AS (
    SELECT
        cs.visma_customer_no,
        SUM(CASE WHEN cs.periode BETWEEN p.t12m_from      AND p.t12m_to      THEN cs.belob ELSE 0 END) AS t12m,
        SUM(CASE WHEN cs.periode BETWEEN p.t12m_prev_from AND p.t12m_prev_to THEN cs.belob ELSE 0 END) AS t12m_forrige,
        SUM(CASE WHEN cs.periode BETWEEN p.aatd_from      AND p.aatd_to      THEN cs.belob ELSE 0 END) AS aatd,
        SUM(CASE WHEN cs.periode BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN cs.belob ELSE 0 END) AS aatd_sidste_aar,
        SUM(CASE WHEN cs.periode BETWEEN p.seneste_3m_from      AND p.seneste_3m_to      THEN cs.belob ELSE 0 END) AS seneste_3m,
        SUM(CASE WHEN cs.periode BETWEEN p.seneste_3m_prev_from AND p.seneste_3m_prev_to THEN cs.belob ELSE 0 END) AS seneste_3m_forrige,
        SUM(CASE WHEN cs.periode BETWEEN p.hele_sidste_aar_from AND p.hele_sidste_aar_to THEN cs.belob ELSE 0 END) AS hele_sidste_aar
      FROM customer_sales cs
      CROSS JOIN periods p
     GROUP BY cs.visma_customer_no
)
SELECT
    a.visma_customer_no,
    cl.company_id,
    c.name                      AS kunde,
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

COMMENT ON VIEW public.v_sales_customer_periods IS
    'Kunde × periode-aggregater (T12M, ÅTD, 3M + vækst). Salgstype-agnostisk. Reference-punkt = seneste måned i sales_monthly_lago. Tom tabel → 0 rækker.';

-- ---------------------------------------------------------------------
-- v_sales_district_periods
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_sales_district_periods AS
WITH ref AS (
    SELECT MAX(make_date(aar::int, maaned::int, 1)) AS ref_month
      FROM public.sales_monthly_lago
    HAVING MAX(make_date(aar::int, maaned::int, 1)) IS NOT NULL
),
periods AS (
    SELECT
        ref_month,
        (ref_month - INTERVAL '11 months')::date AS t12m_from,
        ref_month                                AS t12m_to,
        (ref_month - INTERVAL '23 months')::date AS t12m_prev_from,
        (ref_month - INTERVAL '12 months')::date AS t12m_prev_to,
        DATE_TRUNC('year', ref_month)::date      AS aatd_from,
        ref_month                                AS aatd_to,
        (DATE_TRUNC('year', ref_month) - INTERVAL '1 year')::date AS aatd_prev_from,
        (ref_month - INTERVAL '1 year')::date    AS aatd_prev_to,
        (ref_month - INTERVAL '2 months')::date  AS seneste_3m_from,
        ref_month                                AS seneste_3m_to,
        (ref_month - INTERVAL '5 months')::date  AS seneste_3m_prev_from,
        (ref_month - INTERVAL '3 months')::date  AS seneste_3m_prev_to
      FROM ref
),
sales_with_dim AS (
    SELECT
        s.belob,
        make_date(s.aar::int, s.maaned::int, 1) AS periode,
        cl.distrikt,
        cl.kundetype
      FROM public.sales_monthly_lago s
      LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = s.visma_customer_no
)
SELECT
    swd.distrikt,
    swd.kundetype,
    GROUPING(swd.distrikt, swd.kundetype) AS grouping_id,
    SUM(CASE WHEN swd.periode BETWEEN p.t12m_from      AND p.t12m_to      THEN swd.belob ELSE 0 END) AS t12m,
    SUM(CASE WHEN swd.periode BETWEEN p.t12m_prev_from AND p.t12m_prev_to THEN swd.belob ELSE 0 END) AS t12m_forrige,
    SUM(CASE WHEN swd.periode BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END) AS aatd,
    SUM(CASE WHEN swd.periode BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END) AS aatd_sidste_aar,
    SUM(CASE WHEN swd.periode BETWEEN p.seneste_3m_from      AND p.seneste_3m_to      THEN swd.belob ELSE 0 END) AS seneste_3m,
    SUM(CASE WHEN swd.periode BETWEEN p.seneste_3m_prev_from AND p.seneste_3m_prev_to THEN swd.belob ELSE 0 END) AS seneste_3m_forrige,
    (SUM(CASE WHEN swd.periode BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END)
     - SUM(CASE WHEN swd.periode BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END)) AS aatd_vaekst_kr,
    ROUND(
        ((SUM(CASE WHEN swd.periode BETWEEN p.aatd_from      AND p.aatd_to      THEN swd.belob ELSE 0 END)
          - SUM(CASE WHEN swd.periode BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END))
         / NULLIF(SUM(CASE WHEN swd.periode BETWEEN p.aatd_prev_from AND p.aatd_prev_to THEN swd.belob ELSE 0 END), 0))
        * 100, 1
    ) AS aatd_vaekst_pct
  FROM sales_with_dim swd
  CROSS JOIN periods p
 GROUP BY GROUPING SETS (
    (swd.distrikt, swd.kundetype),
    (swd.distrikt),
    ()
 )
 HAVING (SELECT COUNT(*) FROM sales_with_dim) > 0;

COMMENT ON VIEW public.v_sales_district_periods IS
    'Distrikt × kundetype (m. subtotaler + grand total). grouping_id: 0=celle, 1=distrikt-subtotal, 3=grand total. Tom tabel → 0 rækker.';

-- ---------------------------------------------------------------------
-- v_customer_activity_status
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_customer_activity_status AS
WITH ref AS (
    SELECT MAX(make_date(aar::int, maaned::int, 1)) AS ref_month
      FROM public.sales_monthly_lago
    HAVING MAX(make_date(aar::int, maaned::int, 1)) IS NOT NULL
),
thresholds AS (
    SELECT
        COALESCE(
            (SELECT (value->>'belob_min')::numeric
               FROM public.lago_settings
              WHERE key = 'inactive_thresholds'),
            2500
        ) AS belob_min,
        COALESCE(
            (SELECT (value->>'vindue_aar')::int
               FROM public.lago_settings
              WHERE key = 'inactive_thresholds'),
            2
        ) AS vindue_aar
),
periods AS (
    SELECT
        ref_month,
        (ref_month - make_interval(months => (t.vindue_aar * 12 - 1)))::date AS vindue_from,
        ref_month                                AS vindue_to,
        (ref_month - INTERVAL '11 months')::date AS t12m_from,
        ref_month                                AS t12m_to,
        EXTRACT(YEAR FROM ref_month)::int        AS current_year,
        (EXTRACT(YEAR FROM ref_month)::int - 1)  AS prev_year,
        t.belob_min
      FROM ref, thresholds t
),
customer_sales AS (
    SELECT
        s.visma_customer_no,
        s.aar::int AS aar_int,
        make_date(s.aar::int, s.maaned::int, 1) AS periode,
        s.belob
      FROM public.sales_monthly_lago s
),
per_customer AS (
    SELECT
        cs.visma_customer_no,
        SUM(CASE WHEN cs.periode BETWEEN p.vindue_from AND p.vindue_to THEN cs.belob ELSE 0 END) AS belob_i_vindue,
        SUM(CASE WHEN cs.periode BETWEEN p.t12m_from   AND p.t12m_to   THEN cs.belob ELSE 0 END) AS t12m,
        SUM(CASE WHEN cs.aar_int = p.current_year THEN cs.belob ELSE 0 END) AS i_aar,
        SUM(CASE WHEN cs.aar_int = p.prev_year    THEN cs.belob ELSE 0 END) AS sidste_aar,
        p.belob_min
      FROM customer_sales cs
      CROSS JOIN periods p
     GROUP BY cs.visma_customer_no, p.belob_min
)
SELECT
    pc.visma_customer_no,
    cl.company_id,
    c.name                      AS kunde,
    cl.distrikt,
    cl.segment,
    cl.kundetype,
    pc.belob_i_vindue,
    pc.t12m,
    pc.i_aar,
    pc.sidste_aar,
    (pc.belob_i_vindue > pc.belob_min AND pc.t12m = 0) AS inaktiv,
    (pc.sidste_aar = 0 AND pc.i_aar > 0)               AS ny_i_aar
  FROM per_customer pc
  LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = pc.visma_customer_no
  LEFT JOIN public.companies      c  ON c.id = cl.company_id;

COMMENT ON VIEW public.v_customer_activity_status IS
    'Inaktiv (købt >belob_min i vindue_aar år, 0 i T12M) + ny_i_aar. Grænser fra lago_settings.inactive_thresholds. Tom tabel → 0 rækker.';

-- ---------------------------------------------------------------------
-- NY: v_open_orders_categorised — udleder kategori fra rå felter
-- ---------------------------------------------------------------------
--
-- Prioritet (fra brief 19b):
--   1. En Primeur (status = 21) — femte kategori, vises separat,
--      må ALDRIG blandes ind i aldersbilledet
--   2. Restordre (i_rest > 0) — vinder over MAV når begge gælder
--   3. MAV (ordreart = 2) — Leveres med andre varer
--   4. Uden ønsket leveringsdato — "ingen har taget stilling"
--   5. Med ønsket leveringsdato — resten
--
-- Ordreart-værdien er fx "2 [Leveres med andre varer]" — vi splitter
-- på mellemrum for at tage tallet foran klammen. Samme for status.

CREATE OR REPLACE VIEW public.v_open_orders_categorised AS
SELECT
    oo.ordre_nr,
    oo.linje_nr,
    oo.visma_customer_no,
    cl.company_id,
    c.name                       AS kunde,
    cl.distrikt,
    cl.segment,
    cl.kundetype,
    oo.ordre_dato,
    oo.ordreart,
    oo.status,
    oo.kampagne,
    oo.saelger,
    oo.produktnr,
    oo.beskrivelse,
    oo.produktgruppe,
    oo.kundeprisgruppe,
    oo.salgstype,
    oo.antal,
    oo.rest,
    oo.i_rest,
    oo.ej_faktureret,
    oo.oensket_leveringsdato,
    oo.bekraeftet_lev_dato,
    oo.sellerno,
    oo.er_testdata,
    CASE
        WHEN split_part(oo.status,   ' ', 1) = '21' THEN 'en_primeur'
        WHEN oo.i_rest > 0                          THEN 'restordre'
        WHEN split_part(oo.ordreart, ' ', 1) = '2'  THEN 'mav'
        WHEN oo.oensket_leveringsdato IS NULL       THEN 'uden_dato'
        ELSE                                             'med_dato'
    END                          AS kategori,
    (CURRENT_DATE - oo.ordre_dato) AS alder_dage
  FROM public.open_orders_lago oo
  LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = oo.visma_customer_no
  LEFT JOIN public.companies      c  ON c.id = cl.company_id;

COMMENT ON VIEW public.v_open_orders_categorised IS
    'Åbne ordrelinjer med udledt kategori (en_primeur/restordre/mav/uden_dato/med_dato) + alder i dage fra ordre_dato. Kategorien udledes hver gang så regeljustering ikke kræver reimport.';

GRANT SELECT ON public.v_sales_customer_periods       TO authenticated;
GRANT SELECT ON public.v_sales_district_periods       TO authenticated;
GRANT SELECT ON public.v_customer_activity_status     TO authenticated;
GRANT SELECT ON public.v_open_orders_categorised      TO authenticated;
