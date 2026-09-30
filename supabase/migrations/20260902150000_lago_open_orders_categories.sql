-- LAGO Domain-brief 19 trin 3 — kategorier + leveringsdato på åbne ordrer.
--
-- Ny domæneviden fra Jonas (2. sep 2026): åbne ordrer falder i fire
-- kategorier, og alder betyder noget forskelligt i hver:
--
--   leveringsdato — først problem når leveringsdato er passeret
--   uden_dato     — problem fra dag ét (ingen har taget stilling)
--   mav           — "med andre varer", sjældent problem indtil gammel
--   restordre     — først problem når varen er kommet hjem (kræver
--                   indkøbs- + lagerdata → brief 20)
--
-- Begge kolonner kommer fra samme Ordrelinier-udtræk — ingen ny
-- datakilde. Tages med NU så første import ikke skal køres igen når
-- brief 20 (restordre-alarm) rammer.
--
-- Additivt, LAGO-only, idempotent (IF NOT EXISTS).

ALTER TABLE public.open_orders_lago
    ADD COLUMN IF NOT EXISTS ordre_type    text,
    ADD COLUMN IF NOT EXISTS leveringsdato date;

-- Constraint tilføjes separat så eksisterende rows (der ikke findes
-- endnu, men princippet holder) ikke bryder additivet.
ALTER TABLE public.open_orders_lago
    DROP CONSTRAINT IF EXISTS open_orders_lago_ordre_type_check;
ALTER TABLE public.open_orders_lago
    ADD CONSTRAINT open_orders_lago_ordre_type_check
    CHECK (ordre_type IS NULL
           OR ordre_type IN ('leveringsdato', 'uden_dato', 'mav', 'restordre'));

CREATE INDEX IF NOT EXISTS open_orders_lago_type_idx
    ON public.open_orders_lago (ordre_type)
    WHERE ordre_type IS NOT NULL;
