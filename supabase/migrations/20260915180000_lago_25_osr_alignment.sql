-- LAGO Domain-brief 25 · OSR-alignment
--
-- OneStopReporting-formatet erstatter det håndlavede 19b-format som
-- kilde. Denne migration bringer schemaet i takt:
--
--   products_lago
--     - DROP bogfoeringsgruppe   — Jonas: "udgår, findes ikke i nogen VISMA-eksport"
--     - ADD  produktgruppe       — den, alle filtre hviler på i forvejen
--     - ADD  fysisk_beholdning, reserveret, tilgang, realiseret_beholdning
--       (Reserverbart = fysisk − reserveret, fastlagt 10. sep — gemmes ikke)
--
--   open_orders_lago
--     - ADD  levering            — VISMA-navnet, erstatter ordreart som
--                                   input; ordreart bevares nullable som
--                                   fossil (gammel data forsvinder ved
--                                   næste importer siden import ER
--                                   erstatning).
--     - ADD  antal_faerdigmeldt  — så rest = antal − antal_faerdigmeldt
--                                   kan beregnes og bevares (brief §2:
--                                   "bevar begge råtal, så beregningen
--                                   kan efterprøves").
--
--   v_open_orders_categorised — genopbygges med ny 9-kategori-model
--   (brief §2 + §3 + §4b), rækkefølge er BEVIDST og må ikke ændres.
--
-- Undtages lagerhåndtering=1 filtreres i importen, ikke her. En række
-- der havner i denne tabel har PER DEFINITION undtages=0.
--
-- Indkøbsordrer (status 11/12/19/20) afvises også i importen; hvis en
-- alligevel når viewet, får den kategori 'INDKOEB_LAP' så den kan ses
-- som en fejlagtig indsætning.

-- ---------- products_lago -------------------------------------------

ALTER TABLE public.products_lago
    ADD COLUMN IF NOT EXISTS produktgruppe          text,
    ADD COLUMN IF NOT EXISTS fysisk_beholdning      numeric(14, 2),
    ADD COLUMN IF NOT EXISTS reserveret             numeric(14, 2),
    ADD COLUMN IF NOT EXISTS tilgang                numeric(14, 2),
    ADD COLUMN IF NOT EXISTS realiseret_beholdning  numeric(14, 2);

-- Ryd det gamle index først (peger på DROP'et kolonne), så gøres droppet.
DROP INDEX IF EXISTS public.products_lago_bogfoeringsgruppe_idx;
ALTER TABLE public.products_lago
    DROP COLUMN IF EXISTS bogfoeringsgruppe;

CREATE INDEX IF NOT EXISTS products_lago_produktgruppe_idx
    ON public.products_lago (produktgruppe)
    WHERE produktgruppe IS NOT NULL;

COMMENT ON COLUMN public.products_lago.produktgruppe IS
  'Brief 25: erstatter bogfoeringsgruppe. Alle filtre hviler på produktgruppe (samme begreb som transaktionernes Produktgruppe).';

COMMENT ON COLUMN public.products_lago.fysisk_beholdning IS
  'Antal fysisk på lager. Brief 25 pkt 4.2 — Reserverbart = fysisk − reserveret.';

COMMENT ON COLUMN public.products_lago.reserveret IS
  'Antal reserveret på åbne ordrer. Brief 25 pkt 4.2.';

-- ---------- open_orders_lago ----------------------------------------

ALTER TABLE public.open_orders_lago
    ADD COLUMN IF NOT EXISTS levering            text,
    ADD COLUMN IF NOT EXISTS antal_faerdigmeldt  numeric(14, 2);

COMMENT ON COLUMN public.open_orders_lago.levering IS
  'Brief 25: VISMAs Levering-kolonne. Erstatter ordreart som primær kategori-input. Værdier: 0/1/5 mv. Se projektgrundlag/VISMA_datamodel_og_ordretyper.md §3c.';

COMMENT ON COLUMN public.open_orders_lago.antal_faerdigmeldt IS
  'Brief 25: så rest = antal − antal_faerdigmeldt kan beregnes og efterprøves. VISMAs Rest-kolonne eksponeres ikke i OSR — vi beregner den ved import og gemmer i public.open_orders_lago.rest.';

COMMENT ON COLUMN public.open_orders_lago.ordreart IS
  'DEPRECATED (brief 25). Skrives ikke længere af OSR-importen; feltet står som fossil for gammel data. Kategori læses fra levering.';

-- ---------- v_open_orders_categorised — v4 (OSR-model) --------------
--
-- ⚠️ Rækkefølgen i CASE er BEVIDST (brief 25 §2). Første WHEN der
-- rammer, vinder. Ombyt ikke uden at læse §2 + §4b samtidig.
--
-- DROP + CREATE (ikke OR REPLACE): kolonne-navne ændrer sig
-- (ordreart→levering, ej_faktureret→beloeb, status→ordrestatus) og
-- Postgres tillader ikke rename via CREATE OR REPLACE VIEW.

DROP VIEW IF EXISTS public.v_open_orders_categorised;
CREATE VIEW public.v_open_orders_categorised AS
SELECT
    oo.ordre_nr,
    oo.linje_nr,
    oo.visma_customer_no,
    cl.company_id,
    c.name                          AS kunde,
    cl.distrikt,
    cl.segment,
    cl.kundetype,
    oo.ordre_dato,
    oo.levering,
    oo.status                       AS ordrestatus,
    oo.kampagne,
    oo.saelger,
    oo.produktnr,
    p.beskrivelse                   AS produktnavn,
    oo.produktgruppe,
    oo.kundeprisgruppe,
    oo.salgstype,
    oo.antal,
    oo.antal_faerdigmeldt,
    oo.rest,
    oo.i_rest,                       -- deprecated fossil (brief 25)
    oo.ej_faktureret                AS beloeb,
    oo.oensket_leveringsdato,
    oo.faerdigmeldingsdato,
    oo.sellerno,
    oo.er_testdata,
    CASE
        WHEN split_part(oo.status, ' ', 1) IN ('11','12','19','20') THEN 'INDKOEB_LAP'
        WHEN split_part(oo.status, ' ', 1) IN ('50','51')            THEN 'fejl'
        WHEN split_part(oo.status, ' ', 1) IN ('23','30')            THEN 'ikke_kundeordre'
        WHEN split_part(oo.levering, ' ', 1) = '5'                   THEN 'reservation'
        WHEN split_part(oo.status,  ' ', 1) = '21'                   THEN 'en_primeur'
        WHEN COALESCE(oo.rest, 0) > 0                                THEN 'restordre'
        WHEN split_part(oo.levering, ' ', 1) = '1'                   THEN 'mav'
        WHEN oo.oensket_leveringsdato IS NULL                        THEN 'uden_dato'
        ELSE                                                              'med_dato'
    END                             AS kategori,
    -- action_relevant: TRUE når kategorien hører hjemme i handlingslister.
    -- reservation/ikke_kundeordre/INDKOEB_LAP holdes ude — brief 25 §2+§4b.
    (
        NOT (split_part(oo.status, ' ', 1) IN ('11','12','19','20','23','30'))
        AND NOT (split_part(oo.levering, ' ', 1) = '5')
    )                               AS action_relevant,
    (CURRENT_DATE - oo.ordre_dato)  AS alder_dage
  FROM public.open_orders_lago oo
  LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = oo.visma_customer_no
  LEFT JOIN public.companies      c  ON c.id = cl.company_id
  LEFT JOIN public.products_lago  p  ON p.produktnr = oo.produktnr;

COMMENT ON VIEW public.v_open_orders_categorised IS
    'Brief 25 · v4 (OSR-model). Kategoriseringens rækkefølge er BEVIDST — se brief 25 §2+§4b. action_relevant filtrerer handlingslister uden at skjule fejl/en_primeur/mv.';

GRANT SELECT ON public.v_open_orders_categorised  TO authenticated;
