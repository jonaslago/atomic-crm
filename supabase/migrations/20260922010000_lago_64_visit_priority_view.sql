-- Brief 64 fase 1 (18. sep 2026) · customers_with_priority_lago
--
-- ÉN kilde til besøgs-grundstatus. View'et beregner status og
-- days_overdue per kunde efter samme regler som klientsidens
-- computeVisitPriority(). Ringelisten og andre lister filtrerer
-- OVENPÅ (ringelisten kræver også next_visit_planned IS NULL og
-- days_overdue >= 5); view'et selv siger kun "over sit interval",
-- ikke "bør ringes til".
--
-- Tre ting eksplicit — hvor klientsiden har egne regler, følger view'et
-- dem PRÆCIS, ikke SQL's standardopførsel:
--
--   1. Segment X eller L → status='no_urgency', days_overdue=NULL.
--      De 88 X-kunder skal have grå prik, ikke rød. Uden CASE-branchen
--      ville NULL i interval falde igennem til en sammenligning og
--      give forkert svar.
--
--   2. last_visit_at IS NULL → status='never_visited', days_overdue=NULL.
--      "Aldrig besøgt" er en tilstand, ikke en manglende værdi. SQL
--      NULL-forplantning (now() - NULL = NULL) er ikke svaret.
--      never_visited-gruppen er den største — 159 af 260 kunder i går.
--
--   3. Intervals-fallback matcher useVisitIntervals.ts: A=30, B=60,
--      C=90, soonRatio=0.85. Hvis lago_settings-rækken mangler helt,
--      bruges disse defaults.
--
-- Fase 1's regel (brief §4): ingen læser skiftes. View'et bygges,
-- tørløb sammenligner med klient kunde-for-kunde, priority.ts står
-- urørt. Rollback = DROP VIEW.

CREATE OR REPLACE VIEW public.customers_with_priority_lago AS
WITH intervals_row AS (
  SELECT
    coalesce((value->>'A')::int, 30)              AS days_a,
    coalesce((value->>'B')::int, 60)              AS days_b,
    coalesce((value->>'C')::int, 90)              AS days_c,
    coalesce((value->>'soonRatio')::numeric, 0.85) AS soon_ratio
  FROM public.lago_settings
  WHERE key = 'visit_intervals'
),
intervals AS (
  -- Hvis rækken mangler helt, brug hard-coded defaults. UNION vinder
  -- ingen af to rækker fordi WHERE NOT EXISTS udelukker det.
  SELECT * FROM intervals_row
  UNION ALL
  SELECT 30, 60, 90, 0.85::numeric
  WHERE NOT EXISTS (SELECT 1 FROM intervals_row)
)
SELECT
  cl.company_id,
  CASE
    -- 1) Segment X/L: no_urgency (grå), uanset besøgshistorik.
    WHEN cl.segment IN ('X', 'L') THEN 'no_urgency'
    -- 2) Aldrig besøgt: never_visited (grå, øverst i sortering).
    WHEN cl.last_visit_at IS NULL THEN 'never_visited'
    -- 3) A/B/C med last_visit_at: normal beregning.
    WHEN calc.days_overdue > 0 THEN 'overdue'
    WHEN calc.days_since_visit >= calc.interval_days * i.soon_ratio THEN 'soon'
    ELSE 'on_plan'
  END AS status,
  CASE
    -- days_overdue giver kun mening for A/B/C med last_visit_at.
    -- Ellers NULL — matcher klientens `daysOverdue: null`.
    WHEN cl.segment IN ('X', 'L') THEN NULL
    WHEN cl.last_visit_at IS NULL THEN NULL
    ELSE calc.days_overdue
  END AS days_overdue,
  -- Rå tal til debug/verifikation. Ikke brugt af klient-læsere endnu.
  calc.interval_days,
  calc.days_since_visit
FROM public.companies_lago cl
CROSS JOIN intervals i
CROSS JOIN LATERAL (
  SELECT
    -- pickIntervalDays: A/B/C har eksplicit; X/L bruger B som
    -- fallback (samme som klient — men de får no_urgency-status
    -- alligevel, så det påvirker ikke resultatet).
    CASE cl.segment
      WHEN 'A' THEN i.days_a
      WHEN 'B' THEN i.days_b
      WHEN 'C' THEN i.days_c
      ELSE i.days_b
    END AS interval_days,
    -- floor((now - last) / 1 day). NULL for aldrig-besøgt.
    CASE
      WHEN cl.last_visit_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - cl.last_visit_at)) / 86400)::int
    END AS days_since_visit,
    -- days_since - interval. NULL for aldrig-besøgt (NULL - N = NULL).
    CASE
      WHEN cl.last_visit_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - cl.last_visit_at)) / 86400)::int
           - CASE cl.segment
               WHEN 'A' THEN i.days_a
               WHEN 'B' THEN i.days_b
               WHEN 'C' THEN i.days_c
               ELSE i.days_b
             END
    END AS days_overdue
) calc;

COMMENT ON VIEW public.customers_with_priority_lago IS
'Brief 64 fase 1 (18. sep 2026): grundstatus for hver kunde. Erstatter over tid klientsidens computeVisitPriority() — se priority.ts. Ringelisten og andre lister filtrerer OVENPAA (next_visit_planned IS NULL, days_overdue >= 5 osv). View giver "over sit interval", ikke "boer ringes til".';

-- RLS: read-only, alle authenticated. Selve companies_lago har allerede
-- RLS på selve rækkerne — view'et arver adgangen.
GRANT SELECT ON public.customers_with_priority_lago TO authenticated;
