-- Brief 53 §3 + Brief 55 tillæg A (17. sep 2026) · branche trin A.
--
-- Feltet kommer fra VISMA (parses i src/lago/settings/salesImport/parsers/
-- kunder.ts som fritekst → companies_lago.branche). Det er VISMA-ejet,
-- så CRM-siden bliver et forslag (brief 46-mønsteret) — men FØRST skal
-- vi have listen som en tabel, koden på kunden, og importen skal mappe.
-- Trin B (forslagsdialog med rulleliste) kommer i separat migration.
--
-- Tre stykker:
--   1) brancher_lago-tabel + seed (17 aktive + 3 udgåede)
--   2) companies_lago.branche → omdøb til branche_visma_tekst;
--      ny branche_kode-kolonne (int, FK til brancher_lago.kode)
--   3) Populer branche_kode ved at matche branche_visma_tekst mod
--      brancher_lago (kode og navn, case-insensitive + trim)
--
-- "0" mappes IKKE til noget. Skel: "0" = ingen har set på kunden;
-- 98 Uspec. = mennesket har set og ikke kunnet placere. Smeltes de
-- sammen, mister vi målingen af hvor meget arbejde der er tilbage
-- (samme skel som segment X).

-- 1) Tabel + seed ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brancher_lago (
    kode      int PRIMARY KEY,
    navn      text NOT NULL,
    aktiv     boolean NOT NULL DEFAULT true,
    sortering int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed: 17 aktive fra VISMA-dialogen (Brief 53 §3) + 3 udgåede
-- (Brief 55 tillæg A §1b — kunder findes med koderne, men VISMA
-- tilbyder dem ikke længere; aktiv=false så de ikke kan vælges på
-- nye, men de 42 kunder beholder værdien).
INSERT INTO public.brancher_lago (kode, navn, aktiv, sortering) VALUES
    (5,  'Vinhandlere',            true,  10),
    (19, 'Købmænd/Supermarkeder',  true,  20),
    (20, 'Gavebutikker',           true,  30),
    (23, 'Andre butikker',         true,  40),
    (30, 'Grossister andre',       true,  50),
    (40, 'Horeca',                 true,  60),
    (46, 'B2B',                    true,  70),
    (56, 'Travel Retail, øvrige',  true,  80),
    (57, 'Grænsehandel',           true,  90),
    (60, 'Salg øvrige',            true, 100),
    (65, 'Personale',              true, 110),
    (70, 'Leverandør',             true, 120),
    (92, 'Incasso',                true, 130),
    (93, 'Under konkurs',          true, 140),
    (94, 'Ophørt',                 true, 150),
    (98, 'Uspec.',                 true, 160),
    (99, 'Gaver/Prøver',           true, 170),
    (25, 'Udgået kode 25',         false, 1000),
    (35, 'Udgået kode 35',         false, 1001),
    (90, 'Udgået kode 90',         false, 1002)
ON CONFLICT (kode) DO NOTHING;

-- 2) Omdøb + ny kolonne --------------------------------------------

-- IF EXISTS så migrationen kan rulles idempotent selv hvis den har
-- kørt delvist tidligere.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'companies_lago'
       AND column_name = 'branche'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'companies_lago'
       AND column_name = 'branche_visma_tekst'
  ) THEN
    ALTER TABLE public.companies_lago
      RENAME COLUMN branche TO branche_visma_tekst;
  END IF;
END $$;

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS branche_kode int
    REFERENCES public.brancher_lago(kode) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_lago_branche_kode_idx
    ON public.companies_lago(branche_kode)
    WHERE branche_kode IS NOT NULL;

-- 3) Populer branche_kode ------------------------------------------

-- Match på (a) kode som streng ("5", "60"), (b) kode med foranstillet
-- nul ("05"), (c) tekst-match case-insensitive med trim. "0" (928
-- kunder) filtreres eksplicit — det er "ingen branche sat", ikke en
-- kategori. NULL bliver da også resultatet for de kunder.
UPDATE public.companies_lago cl
   SET branche_kode = b.kode
  FROM public.brancher_lago b
 WHERE cl.branche_visma_tekst IS NOT NULL
   AND btrim(cl.branche_visma_tekst) <> ''
   AND btrim(cl.branche_visma_tekst) <> '0'
   AND cl.branche_kode IS NULL
   AND (
     btrim(cl.branche_visma_tekst) = b.kode::text
     OR btrim(cl.branche_visma_tekst) = lpad(b.kode::text, 2, '0')
     OR lower(btrim(cl.branche_visma_tekst)) = lower(b.navn)
   );

-- 3b) map_branche_kode() RPC — kaldes efter hver kundeimport --------

-- Kaldes fra executeImport.ts efter customers-payloaden er skrevet.
-- Genberegner branche_kode ud fra den (måske netop opdaterede)
-- branche_visma_tekst. Returnerer antal opdaterede rækker så
-- sync-noten kan sige "branche mappet: N".
--
-- Idempotent: kan køres flere gange uden bivirkning. Ændrer kun
-- rækker hvor den nye mappede kode adskiller sig fra den gemte.
--
-- SECURITY DEFINER så importens sales_id ikke kræver admin-adgang.
-- Ingen skrivning ud over branche_kode-kolonnen.
CREATE OR REPLACE FUNCTION public.map_branche_kode()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int := 0;
BEGIN
    -- Første pas: sæt kode hvor vi har en match.
    WITH mapped AS (
      SELECT cl.company_id, b.kode AS new_kode
        FROM public.companies_lago cl
        JOIN public.brancher_lago b ON (
          btrim(cl.branche_visma_tekst) = b.kode::text
          OR btrim(cl.branche_visma_tekst) = lpad(b.kode::text, 2, '0')
          OR lower(btrim(cl.branche_visma_tekst)) = lower(b.navn)
        )
       WHERE cl.branche_visma_tekst IS NOT NULL
         AND btrim(cl.branche_visma_tekst) <> ''
         AND btrim(cl.branche_visma_tekst) <> '0'
    )
    UPDATE public.companies_lago cl
       SET branche_kode = m.new_kode
      FROM mapped m
     WHERE cl.company_id = m.company_id
       AND (cl.branche_kode IS DISTINCT FROM m.new_kode);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Andet pas: ryd branche_kode hvor teksten nu er tom eller "0".
    -- Uden det ville en kunde der før havde en kode og nu har fået
    -- "0" fra VISMA blive stående med den gamle FK.
    UPDATE public.companies_lago
       SET branche_kode = NULL
     WHERE branche_kode IS NOT NULL
       AND (
         branche_visma_tekst IS NULL
         OR btrim(branche_visma_tekst) = ''
         OR btrim(branche_visma_tekst) = '0'
       );

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.map_branche_kode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_branche_kode() TO authenticated;

-- 4) RLS -------------------------------------------------------------

ALTER TABLE public.brancher_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read brancher"
    ON public.brancher_lago;
CREATE POLICY "Authenticated read brancher"
    ON public.brancher_lago
    FOR SELECT TO authenticated USING (true);

-- Admin skriver (opret/omdøb/deaktiver). Kontoret vedligeholder ikke
-- listen — kun admin.
DROP POLICY IF EXISTS "Admin write brancher"
    ON public.brancher_lago;
CREATE POLICY "Admin write brancher"
    ON public.brancher_lago
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.sales
         WHERE user_id = auth.uid()
           AND (administrator = true OR lago_role = 'admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.sales
         WHERE user_id = auth.uid()
           AND (administrator = true OR lago_role = 'admin')
      )
    );
