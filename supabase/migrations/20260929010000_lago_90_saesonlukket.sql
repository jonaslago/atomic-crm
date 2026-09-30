-- Brief 90 §3 (28. sep 2026): sæsonlukket som periode, ikke som flueben.
--
-- En vinhandel der lukker om sommeren er ikke en tabt kunde. I dag
-- tikker besøgsuret videre og hun ender på ringelisten for noget ingen
-- kan gøre ved. Byg det som en periode: åbner sig af sig selv når
-- datoen passerer, ingen glemmer at slå fluebenet fra.
--
-- Og — VIGTIGT — uret må ikke nulstilles. Når hun åbner igen, skal
-- overskridelsen være den den var. Sæsonlukning er en pause, ikke et
-- besøg. last_visit_at røres derfor ikke; view'et beregner status og
-- days_overdue som før, men skjuler dem bag 'saesonlukket'-status i
-- vinduet. Så snart target-dato er passeret, får kunden sin gamle
-- days_overdue tilbage — samme sekund view'et evalueres.
--
-- Denne migration:
--   1. Tilføjer saesonlukket_fra + saesonlukket_til til companies_lago
--   2. Opdaterer customers_with_priority_lago så status = 'saesonlukket'
--      i vinduet, days_overdue = NULL. Bevaret: interval_days,
--      days_since_visit (uret tikker videre i baggrunden)
--   3. Ringelistens filter (status='overdue') udelukker automatisk
--      sæsonlukkede — ingen ændring i dashboard_ringeliste_lago
--   4. TraengerWidget bruger samme view, samme udeholdelse

ALTER TABLE public.companies_lago
  ADD COLUMN IF NOT EXISTS saesonlukket_fra date,
  ADD COLUMN IF NOT EXISTS saesonlukket_til date;

COMMENT ON COLUMN public.companies_lago.saesonlukket_fra IS
'Brief 90 §3 (28. sep 2026): start på sæsonlukket-periode. Inklusiv. NULL = ikke sæsonlukket. Skal sættes sammen med saesonlukket_til.';

COMMENT ON COLUMN public.companies_lago.saesonlukket_til IS
'Brief 90 §3 (28. sep 2026): slut på sæsonlukket-periode. Inklusiv. Kunden åbner AUTOMATISK dagen efter denne dato — view''et evaluerer det ved næste opslag. NULL = ikke sæsonlukket.';

-- Sanity-check constraint: både eller ingen af de to datoer.
ALTER TABLE public.companies_lago
  DROP CONSTRAINT IF EXISTS companies_lago_saesonlukket_par_chk;
ALTER TABLE public.companies_lago
  ADD CONSTRAINT companies_lago_saesonlukket_par_chk
  CHECK (
    (saesonlukket_fra IS NULL AND saesonlukket_til IS NULL)
    OR (saesonlukket_fra IS NOT NULL AND saesonlukket_til IS NOT NULL
        AND saesonlukket_til >= saesonlukket_fra)
  );

-- Priority-view: 'saesonlukket' som ny status. Ligger FØR X/L-branchen
-- så en sæsonlukket X-kunde stadig vises som sæsonlukket (giver bedre
-- signal end 'no_urgency'), men det er edge-case.
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
  SELECT * FROM intervals_row
  UNION ALL
  SELECT 30, 60, 90, 0.85::numeric
  WHERE NOT EXISTS (SELECT 1 FROM intervals_row)
)
SELECT
  cl.company_id,
  CASE
    -- Brief 90 §3: sæsonlukket først. I vinduet [fra;til] returneres
    -- ny status; ingen af de andre grene evalueres. days_overdue = NULL
    -- så ringelisten ikke ser kunden. Uret tikker uden at være synligt.
    WHEN cl.saesonlukket_fra IS NOT NULL
     AND cl.saesonlukket_til IS NOT NULL
     AND CURRENT_DATE BETWEEN cl.saesonlukket_fra AND cl.saesonlukket_til
      THEN 'saesonlukket'
    WHEN cl.segment IN ('X', 'L') THEN 'no_urgency'
    WHEN cl.last_visit_at IS NULL THEN 'never_visited'
    WHEN calc.days_overdue > 0 THEN 'overdue'
    WHEN calc.days_since_visit >= calc.interval_days * i.soon_ratio THEN 'soon'
    ELSE 'on_plan'
  END AS status,
  CASE
    WHEN cl.saesonlukket_fra IS NOT NULL
     AND cl.saesonlukket_til IS NOT NULL
     AND CURRENT_DATE BETWEEN cl.saesonlukket_fra AND cl.saesonlukket_til
      THEN NULL
    WHEN cl.segment IN ('X', 'L') THEN NULL
    WHEN cl.last_visit_at IS NULL THEN NULL
    ELSE calc.days_overdue
  END AS days_overdue,
  calc.interval_days,
  calc.days_since_visit
FROM public.companies_lago cl
CROSS JOIN intervals i
CROSS JOIN LATERAL (
  SELECT
    CASE cl.segment
      WHEN 'A' THEN i.days_a
      WHEN 'B' THEN i.days_b
      WHEN 'C' THEN i.days_c
      ELSE i.days_b
    END AS interval_days,
    CASE
      WHEN cl.last_visit_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - cl.last_visit_at)) / 86400)::int
    END AS days_since_visit,
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
'Brief 64 fase 1 (18. sep 2026) + brief 90 §3 (28. sep 2026): grundstatus for hver kunde. saesonlukket-status har FORTRIN over alt andet i vinduet [saesonlukket_fra;saesonlukket_til]. Uret tikker videre i baggrunden — når vinduet lukker, får kunden sin gamle days_overdue tilbage samme sekund.';

GRANT SELECT ON public.customers_with_priority_lago TO authenticated;
