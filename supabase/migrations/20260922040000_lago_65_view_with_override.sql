-- Brief 65 (18. sep 2026) · view'et bruger COALESCE(override, segment-default)
--
-- Brief 65 §2: "Efter denne brief maa der ikke findes ét sted i koden,
-- der udleder et interval af et segment." View'et er nu ETSTE sted der
-- laver den udledning — via COALESCE(besoegsfrekvens_dage, segment).
--
-- To subtile regler:
--
--   1. X/L UDEN override: no_urgency (som foer). Uden en frekvens er
--      der ikke en kadence at falde bagud paa.
--
--   2. X/L MED override: normal beregning. Hvis Peter siger "denne
--      X-kunde skal ringes til hver 30. dag", saa er den overdue naar
--      det er 31 dage siden sidste kontakt — ligesom en A-kunde.
--      Feltet hedder besoegsfrekvens, ikke besoegskadence — vi accepterer
--      at en X-kunde kan have en registreret rytme.
--
-- interval_days er nu NULL for X/L uden override (der er ingen kadence).
-- Klienten viser tallet direkte fra view'et — ingen segment-lookup
-- laengere i frontend.

CREATE OR REPLACE VIEW public.customers_with_priority_lago AS
WITH intervals_row AS (
  SELECT
    coalesce((value->>'A')::int, 30)              AS days_a,
    coalesce((value->>'B')::int, 60)              AS days_b,
    coalesce((value->>'C')::int, 75)              AS days_c,
    coalesce((value->>'soonRatio')::numeric, 0.85) AS soon_ratio
  FROM public.lago_settings
  WHERE key = 'visit_intervals'
),
intervals AS (
  SELECT * FROM intervals_row
  UNION ALL
  SELECT 30, 60, 75, 0.85::numeric
  WHERE NOT EXISTS (SELECT 1 FROM intervals_row)
)
SELECT
  cl.company_id,
  CASE
    -- X/L UDEN override: ingen kadence, ingen urgency
    WHEN cl.segment IN ('X', 'L') AND cl.besoegsfrekvens_dage IS NULL
      THEN 'no_urgency'
    -- Aldrig besoegt (uanset segment + override): never_visited
    WHEN cl.last_visit_at IS NULL THEN 'never_visited'
    -- A/B/C (eller X/L med override) med last_visit_at: normal beregning
    WHEN calc.days_overdue > 0 THEN 'overdue'
    WHEN calc.days_since_visit >= calc.interval_days * i.soon_ratio THEN 'soon'
    ELSE 'on_plan'
  END AS status,
  CASE
    WHEN cl.segment IN ('X', 'L') AND cl.besoegsfrekvens_dage IS NULL THEN NULL
    WHEN cl.last_visit_at IS NULL THEN NULL
    ELSE calc.days_overdue
  END AS days_overdue,
  calc.interval_days,
  calc.days_since_visit
FROM public.companies_lago cl
CROSS JOIN intervals i
CROSS JOIN LATERAL (
  SELECT
    -- COALESCE(override, segment-default). NULL for X/L uden override.
    COALESCE(
      cl.besoegsfrekvens_dage,
      CASE cl.segment
        WHEN 'A' THEN i.days_a
        WHEN 'B' THEN i.days_b
        WHEN 'C' THEN i.days_c
        ELSE NULL
      END
    ) AS interval_days,
    CASE
      WHEN cl.last_visit_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - cl.last_visit_at)) / 86400)::int
    END AS days_since_visit,
    CASE
      WHEN cl.last_visit_at IS NULL THEN NULL
      WHEN COALESCE(
        cl.besoegsfrekvens_dage,
        CASE cl.segment
          WHEN 'A' THEN i.days_a
          WHEN 'B' THEN i.days_b
          WHEN 'C' THEN i.days_c
          ELSE NULL
        END
      ) IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - cl.last_visit_at)) / 86400)::int
           - COALESCE(
               cl.besoegsfrekvens_dage,
               CASE cl.segment
                 WHEN 'A' THEN i.days_a
                 WHEN 'B' THEN i.days_b
                 WHEN 'C' THEN i.days_c
               END
             )
    END AS days_overdue
) calc;

COMMENT ON VIEW public.customers_with_priority_lago IS
'Brief 65 (18. sep 2026): grundstatus for hver kunde. interval_days = COALESCE(override, segment-default). Ringelisten filtrerer OVENPAA (next_visit_planned IS NULL, days_overdue >= 5).';

GRANT SELECT ON public.customers_with_priority_lago TO authenticated;
