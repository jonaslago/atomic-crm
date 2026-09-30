-- §11f (29. sep 2026): note-markør på Kan sendes-rækker.
--
-- Måling før byg: 28 af 50 Kan sendes-ordrer har en note. Kun 1 er stop-
-- signal ("Senere levering" på 33900 · Skælskør · 39.051 kr), de øvrige
-- er kampagne-tags (Smageweekend 2026, Portvinspakke 2026, ...). Der er
-- ingen struktureret måde at afgøre om noten stopper afsendelse — kun
-- kontoret kan læse og vurdere. Løsningen er derfor en markør på ALLE
-- ordrer med note, ikke automatisk filtrering.
--
-- Ændring fra 20260929230000-versionen: kunde-rækkerne udvides med
-- `ordre_noter` — en jsonb-array af {ordre_nr, note} for de af kundens
-- Kan sendes-ordrer, der har en ikke-tom note. Alt andet uændret.
--
-- Widget'et viser et notat-ikon efter kunde-navnet når arrayen ikke er
-- tom; klik åbner en popover med selve teksterne.

CREATE OR REPLACE FUNCTION public.dashboard_kan_sendes_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows          jsonb;
    v_total         int;
    v_total_ordrer  int;
    v_total_beloeb  numeric;
BEGIN
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus_effective = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdig,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS ordre_belob,
        -- Note er ens på alle linjer i en ordre (jf. brief 78 tillæg A §3).
        -- MAX plukker en enkelt ikke-null værdi.
        NULLIF(TRIM(MAX(o.note)), '') AS note
      FROM public.open_orders_effective_lago o
      WHERE o.er_par_komponent = false
      GROUP BY o.ordre_nr, o.visma_customer_no
    ),
    kunde_ordrer AS (
      SELECT
        of.visma_customer_no,
        of.ordre_nr,
        of.aeldste_ordredato,
        of.ordre_belob,
        of.note
      FROM ordre_flag of
      WHERE of.all_klar
        AND of.ingen_faerdig
        AND of.levering_nul
        AND of.ikke_mav
        AND of.ikke_ep
    ),
    kunde_agg AS (
      SELECT
        ko.visma_customer_no,
        COUNT(*)::int              AS antal_ordrer,
        SUM(ko.ordre_belob)        AS beloeb,
        MIN(ko.aeldste_ordredato)  AS aeldste_ordredato,
        ARRAY_AGG(ko.ordre_nr ORDER BY ko.aeldste_ordredato ASC) AS ordre_numre,
        -- Kun ordrer med not-null-note kommer med, sorteret på ordre_nr.
        COALESCE(
          jsonb_agg(
            jsonb_build_object('ordre_nr', ko.ordre_nr, 'note', ko.note)
            ORDER BY ko.ordre_nr
          ) FILTER (WHERE ko.note IS NOT NULL),
          '[]'::jsonb
        ) AS ordre_noter
      FROM kunde_ordrer ko
      GROUP BY ko.visma_customer_no
    ),
    joined AS (
      SELECT
        c.id                      AS company_id,
        c.name                    AS kunde,
        c.sales_id,
        cl.visma_customer_no,
        cl.segment,
        cl.distrikt,
        cl.visma_sales_name,
        cl.kreditspaerre,
        k.antal_ordrer,
        k.beloeb,
        k.aeldste_ordredato,
        k.ordre_numre,
        k.ordre_noter,
        row_number() OVER (ORDER BY k.beloeb DESC, k.aeldste_ordredato ASC, c.name ASC) AS rn
      FROM kunde_agg k
      JOIN public.companies_lago cl ON cl.visma_customer_no = k.visma_customer_no
      JOIN public.companies c ON c.id = cl.company_id
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'company_id',        j.company_id,
            'kunde',             j.kunde,
            'sales_id',          j.sales_id,
            'visma_customer_no', j.visma_customer_no,
            'segment',           j.segment,
            'distrikt',          j.distrikt,
            'visma_sales_name',  j.visma_sales_name,
            'kreditspaerre',     j.kreditspaerre,
            'antal_ordrer',      j.antal_ordrer,
            'beloeb',            j.beloeb,
            'aeldste_ordredato', j.aeldste_ordredato,
            'ordre_numre',       to_jsonb(j.ordre_numre),
            'ordre_noter',       j.ordre_noter
          )
          ORDER BY j.beloeb DESC, j.aeldste_ordredato ASC, j.kunde ASC
        ) FILTER (WHERE j.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int,
      COALESCE(SUM(j.antal_ordrer), 0)::int,
      COALESCE(SUM(j.beloeb), 0)
    INTO v_rows, v_total, v_total_ordrer, v_total_beloeb
    FROM joined j;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total,
      'total_ordrer', v_total_ordrer,
      'total_beloeb', v_total_beloeb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_kan_sendes_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kan_sendes_lago(int) TO authenticated;
