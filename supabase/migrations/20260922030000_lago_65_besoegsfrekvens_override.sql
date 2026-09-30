-- Brief 65 (18. sep 2026) · Besoegsfrekvens kan overstyres
--
-- Fire nye CRM-ejede kolonner paa companies_lago. VISMA importen roerer
-- dem ALDRIG; de findes kun i CRM. NULL paa besoegsfrekvens_dage betyder
-- "brug segmentets standard" — det er en tilstand, ikke "ingen frekvens".
--
--   besoegsfrekvens_dage   NULL = default, ellers 7..365
--   besoegsfrekvens_note   fri tekst, vises paa kundekortet + ringelisten
--   besoegsfrekvens_sat_af FK til sales — hvem valgte
--   besoegsfrekvens_sat    hvornaar
--
-- Reglen: "et menneske har valgt saadan" og "ingen har taget stilling"
-- maa aldrig se ens ud. Derfor de to metadata-kolonner. Blot at gemme
-- besoegsfrekvens_dage=60 ville tabe hvem der besluttede det.
--
-- CHECK-constraint haandhaever 7..365. Under en uge er ikke en frekvens;
-- over et aar er en kunde der hoerer i segment X.

ALTER TABLE public.companies_lago
  ADD COLUMN IF NOT EXISTS besoegsfrekvens_dage int
    CHECK (besoegsfrekvens_dage IS NULL OR besoegsfrekvens_dage BETWEEN 7 AND 365),
  ADD COLUMN IF NOT EXISTS besoegsfrekvens_note text,
  ADD COLUMN IF NOT EXISTS besoegsfrekvens_sat_af bigint
    REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS besoegsfrekvens_sat timestamptz;

COMMENT ON COLUMN public.companies_lago.besoegsfrekvens_dage IS
'Brief 65 (18. sep 2026): CRM-ejet override af besoegsfrekvens. NULL = brug segmentets standard. 7..365 dage naar sat.';

COMMENT ON COLUMN public.companies_lago.besoegsfrekvens_note IS
'Brief 65 (18. sep 2026): "hvorfor". Vises paa kundekortet + i ringelisten. Ryddes samtidig med besoegsfrekvens_dage naar "brug standard" vaelges.';

COMMENT ON COLUMN public.companies_lago.besoegsfrekvens_sat_af IS
'Brief 65 (18. sep 2026): hvem valgte frekvensen. FK til sales — SET NULL hvis brugeren slettes, saa historien ikke haandhaever et surrogate.';

COMMENT ON COLUMN public.companies_lago.besoegsfrekvens_sat IS
'Brief 65 (18. sep 2026): hvornaar frekvensen blev valgt. Timestamptz.';
