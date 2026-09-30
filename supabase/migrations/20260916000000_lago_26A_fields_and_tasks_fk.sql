-- LAGO Domain-brief 26 Tillæg A · flere kunde-felter + tasks_sales_id FK
--
-- 1. companies_lago udvides med 6 kolonner OSR-eksporten bærer, som vi
--    hidtil har smidt væk. Alle nullable, ingen visning bygget nu.
--    Kerne-stamdata (name, address, zipcode, city, country, phone,
--    tax_identifier, website) ligger allerede på public.companies —
--    OSR-kolonner mapper direkte.
--
-- 2. Fremmednøgle tasks.sales_id → sales.id, så PostgREST kan lave
--    embedded lookups (fx tasks?select=*,sales(first_name,last_name)).
--    Kontor-dashboardets "Opfølgninger tildelt kontoret" er brudt uden
--    denne relation. tasks er en Atomic-kernetabel — logges i
--    lago/DIVERGENCE.md.

-- ---------- 1. companies_lago felter -------------------------------

ALTER TABLE public.companies_lago
    ADD COLUMN IF NOT EXISTS adresse2      text,
    ADD COLUMN IF NOT EXISTS branche       text,
    ADD COLUMN IF NOT EXISTS er_web_kunde  boolean,
    ADD COLUMN IF NOT EXISTS kreditspaerre boolean,
    ADD COLUMN IF NOT EXISTS omraade       text,
    ADD COLUMN IF NOT EXISTS ansvarlig     text;

COMMENT ON COLUMN public.companies_lago.adresse2 IS
  'Tillæg 26A: VISMAs "Adresse 2"-linje. Adresse 1 ligger på companies.address (upstream).';

COMMENT ON COLUMN public.companies_lago.branche IS
  'Tillæg 26A: VISMAs Branche-kolonne. companies.sector er upstreams eget felt — vi bruger LAGOs egen kolonne for at holde VISMA-master adskilt.';

COMMENT ON COLUMN public.companies_lago.kreditspaerre IS
  'Tillæg 26A: VISMAs Kreditspærre-flag. Værd at kende — sælger bør ikke tage ordre fra en spærret kunde. Ingen UI bygget endnu.';

COMMENT ON COLUMN public.companies_lago.er_web_kunde IS
  'Tillæg 26A: VISMAs "Er web kunde?"-flag. Ingen UI bygget endnu.';

-- ---------- 2. tasks.sales_id FK -----------------------------------
--
-- PostgREST-embedding kræver en foreign key. Uden den fejler:
--   .from("tasks").select("*, sales(first_name, last_name)")
-- med "Could not find a relationship between 'tasks' and 'sales'".

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_sales_id_fkey
    FOREIGN KEY (sales_id) REFERENCES public.sales (id)
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT tasks_sales_id_fkey ON public.tasks IS
  'LAGO Tillæg 26A · nødvendig for PostgREST embed tasks?select=*,sales(...). Simon får Kontor-rollen den 16. sep og skal kunne se opfølgninger tildelt kontoret. Se lago/DIVERGENCE.md.';
