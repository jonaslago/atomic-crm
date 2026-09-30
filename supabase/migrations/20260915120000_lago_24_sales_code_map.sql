-- LAGO Domain-brief 24 · sales_code_map_lago + derive_sales_id_from_visma()
--
-- Mapping VISMA-sælgerkode → CRM-bruger, redigerbar for admin.
-- Én funktion, derive_sales_id_from_visma(), er single source of truth
-- for hvordan companies.sales_id afledes. Alle imports kalder den —
-- ingen import har egen kopi.
--
-- ⚠️ TO NUMMERSYSTEMER SOM OVERLAPPER:
--   visma_sales_code = VISMA-kode (1..999). VISMA-kode 1 = Ole Andreasen.
--   crm_sales_id     = public.sales.id.   CRM sales_id 1 = Jonas Arild.
-- Kolonnenavnene holder dem adskilt.

CREATE TABLE IF NOT EXISTS public.sales_code_map_lago (
    visma_sales_code text PRIMARY KEY,
    crm_sales_id     bigint REFERENCES public.sales (id) ON DELETE SET NULL,
    label            text NOT NULL,
    is_person        boolean NOT NULL DEFAULT true,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    updated_by       bigint REFERENCES public.sales (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.sales_code_map_lago IS
  'VISMA-kode → CRM-bruger. Brief 24. Redigeres kun i Indstillinger. Kode 98/99/999 er ikke mennesker og forbliver med crm_sales_id=NULL.';

COMMENT ON COLUMN public.sales_code_map_lago.visma_sales_code IS
  'VISMAs sælgerkode som tekst. VISMA-nummersystem. VISMA-kode 1 = Ole Andreasen.';

COMMENT ON COLUMN public.sales_code_map_lago.crm_sales_id IS
  'public.sales.id (bigint). CRM-nummersystem. CRM sales_id 1 = Jonas Arild. NULL når koden ikke er en menneskelig bruger (98/99/999).';

COMMENT ON COLUMN public.sales_code_map_lago.is_person IS
  'FALSE for systemkoder (Webshop, System, Ingen sælger tildelt).';

ALTER TABLE public.sales_code_map_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated may read the mapping" ON public.sales_code_map_lago;
CREATE POLICY "Anyone authenticated may read the mapping"
    ON public.sales_code_map_lago
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Only admin may modify the mapping" ON public.sales_code_map_lago;
CREATE POLICY "Only admin may modify the mapping"
    ON public.sales_code_map_lago
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Seed alle elleve rækker fra brief 24. Idempotent — kør migration
-- flere gange uden fejl. Menneskelige koder får crm_sales_id via opslag
-- på lago_sellers.sales_id (satsen kan være NULL indtil user-cleanup +
-- kobling er kørt; admin kan så udfylde den i Indstillinger).
INSERT INTO public.sales_code_map_lago (visma_sales_code, crm_sales_id, label, is_person)
VALUES
    ('1',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '1'   LIMIT 1), 'Ole Andreasen',        true),
    ('3',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '3'   LIMIT 1), 'Jonas Arild',          true),
    ('4',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '4'   LIMIT 1), 'Susanne Ehlers',       true),
    ('5',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '5'   LIMIT 1), 'Kim Czernek',          true),
    ('6',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '6'   LIMIT 1), 'Peter Ærensgaard',     true),
    ('8',   (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '8'   LIMIT 1), 'Simon Jensen',         true),
    ('10',  (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '10'  LIMIT 1), 'Camilla Uhre Pedersen',true),
    ('15',  (SELECT sales_id FROM public.lago_sellers WHERE visma_sales_code = '15'  LIMIT 1), 'Rikke Lund',           true),
    ('98',  NULL, 'Webshop (B2B)',        false),
    ('99',  NULL, 'System',               false),
    ('999', NULL, 'Ingen sælger tildelt', false)
ON CONFLICT (visma_sales_code) DO NOTHING;

-- ---------------------------------------------------------------------
-- derive_sales_id_from_visma() — single source of truth for ejerskab
--
-- To bevidste undtagelser:
--   1. companies_lago.visma_sales_code IS NULL → RØR IKKE. Det er
--      manuelt oprettede kunder (Jonas' tre håndoprettede), som
--      allerede har en ejer. Uden denne regel overskriver nattens
--      import manuelt ejerskab med tomhed.
--   2. crm_sales_id IS NULL i mappingen (98/99/999 og ukendte koder)
--      → sæt companies.sales_id = NULL. En kunde uden ejer skal ikke
--      tildeles til den forrige ejer på ubestemt tid.
--
-- Returnerer et JSON-objekt med tal, så caller kan logge det i
-- sync_runs_lago.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_sales_id_from_visma()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    n_updated int := 0;
    n_skipped_null_code int := 0;
    n_set_to_null int := 0;
BEGIN
    -- Kunder MED en VISMA-kode: sæt/opdater sales_id fra mappingen.
    -- Bemærk: også NULL propageres — hvis kode 98/99/999 eller en
    -- ukendt kode, bliver companies.sales_id NULL. Det er tilsigtet.
    WITH updated AS (
        UPDATE public.companies c
        SET sales_id = m.crm_sales_id
        FROM public.companies_lago cl
        LEFT JOIN public.sales_code_map_lago m
               ON m.visma_sales_code = cl.visma_sales_code
        WHERE cl.company_id = c.id
          AND cl.visma_sales_code IS NOT NULL
          AND c.sales_id IS DISTINCT FROM m.crm_sales_id
        RETURNING c.id, m.crm_sales_id
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE crm_sales_id IS NULL)
    INTO n_updated, n_set_to_null
    FROM updated;

    -- Kunder UDEN VISMA-kode: tælles kun, ikke rørt.
    SELECT COUNT(*) INTO n_skipped_null_code
    FROM public.companies_lago
    WHERE visma_sales_code IS NULL;

    RETURN jsonb_build_object(
        'updated', n_updated,
        'set_to_null', n_set_to_null,
        'skipped_null_code', n_skipped_null_code,
        'ran_at', now()
    );
END;
$$;

COMMENT ON FUNCTION public.derive_sales_id_from_visma() IS
  'Brief 24 · Single source of truth for companies.sales_id. Kaldes af hver import som sidste skridt. Rører ikke kunder uden visma_sales_code (manuelt ejerskab bevares).';

-- Kun admin må kalde funktionen manuelt (fra Indstillinger). Imports
-- kører som service_role via cron/scripts og bypasser grants.
REVOKE ALL ON FUNCTION public.derive_sales_id_from_visma() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.derive_sales_id_from_visma() TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_sales_id_from_visma() TO service_role;
