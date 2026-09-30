-- LAGO Domain-brief 24 · sales_code_map_lago
--
-- Én kanonisk mapping fra VISMA-sælgerkode til CRM-bruger.
-- Ejerskab af en kunde er *afledt* fra VISMA: companies.sales_id fyldes
-- ud af derive_sales_id_from_visma() ved hver kundeimport, aldrig
-- redigeret i brugerfladen (feltet er slaaet fra paa kundesiden).
--
-- ⚠️ TO FORSKELLIGE NUMMERSYSTEMER — DE OVERLAPPER:
--   • visma_sales_code = VISMAs egen kode (1..999). VISMA-kode 1 = Ole Andreasen.
--   • crm_sales_id     = public.sales.id (bigint). CRM sales_id 1 = Jonas Arild.
-- Navngivningen holder dem adskilt saa ingen forveksler dem.
--
-- Tabellen redigeres kun af admin under Indstillinger. Nye koder maa
-- tilfoejes uden migration — det er hvorfor det er en tabel, ikke en
-- konstant. Kode 98 (Webshop/B2B), 99 (System/Exsitec) og 999 (ingen
-- saelger tildelt) har bevidst crm_sales_id = NULL og maa aldrig
-- knyttes til en menneskelig bruger.

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
  'FALSE for systemkoder (Webshop, System, Ingen sælger tildelt). Bruges af UI til at gruppere / farve dem anderledes.';

ALTER TABLE public.sales_code_map_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated may read the mapping" ON public.sales_code_map_lago;
CREATE POLICY "Anyone authenticated may read the mapping"
    ON public.sales_code_map_lago
    FOR SELECT
    TO authenticated
    USING (true);

-- Skriv/opdatér: kun admin. lago_role() er defineret i 99_lago_roles.sql.
DROP POLICY IF EXISTS "Only admin may modify the mapping" ON public.sales_code_map_lago;
CREATE POLICY "Only admin may modify the mapping"
    ON public.sales_code_map_lago
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed: alle elleve rækker fra brief 24. Idempotent — kør migration
-- flere gange uden fejl. Menneskelige koder får crm_sales_id via en
-- opslag på lago_sellers.sales_id (den er allerede sat efter
-- user-oprettelsen — hvis ikke, forbliver den NULL og admin kan sætte
-- den i Indstillinger).
-- ---------------------------------------------------------------------

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
