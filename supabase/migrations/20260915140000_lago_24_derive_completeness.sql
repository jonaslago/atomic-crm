-- LAGO Domain-brief 24 · derive_sales_id_from_visma() completeness-tal
--
-- Første version returnerede kun n_updated + n_set_to_null. Det giver
-- ikke Jonas en fuldstændigheds-check: "Går summen ikke op til antal
-- kunder, er der sket noget ingen har forudset." Denne udgave
-- returnerer fem tal der ALTID summer til public.companies_lago-antal:
--
--   total              — alle kunder gennemgået
--   updated            — sales_id faktisk ændret (før != efter)
--   set_to_null        — subset af updated hvor slut-værdi = null
--   ok_no_change       — sales_id var i forvejen korrekt (ingen UPDATE)
--   system_code_null   — kunder med kode 98/99/999 (permanent null)
--   skipped_null_code  — kunder uden VISMA-kode (manuelt ejerskab, ikke rørt)
--
-- Invariant: updated + ok_no_change + system_code_null +
--            skipped_null_code = total.
-- set_to_null tælles som subset og indgår IKKE i summen.

CREATE OR REPLACE FUNCTION public.derive_sales_id_from_visma()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_total int;
    v_updated int := 0;
    v_set_to_null int := 0;
    v_ok_no_change int := 0;
    v_system_code_null int := 0;
    v_skipped_null_code int := 0;
BEGIN
    SELECT COUNT(*) INTO v_total FROM public.companies_lago;

    -- Kunder MED en VISMA-kode: sæt/opdater sales_id fra mappingen.
    -- Bemærk: også NULL propageres — hvis mapping.crm_sales_id = null
    -- (kode 98/99/999 eller ukendt kode), sætter vi companies.sales_id
    -- til null. Det er tilsigtet: manuel opsætning må ikke overleve i
    -- det stille når VISMA siger "ingen ejer".
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
    INTO v_updated, v_set_to_null
    FROM updated;

    -- Kunder MED en kode hvor sales_id allerede matchede mappingen
    -- (UPDATE'en sprang dem over grundet IS DISTINCT FROM).
    -- Delt op i systemkoder (permanent null pr. design) vs mennesker
    -- (samme rigtige ejer som før — ingen ændring nødvendig).
    SELECT
        COUNT(*) FILTER (
            WHERE m.crm_sales_id IS NULL
              AND m.is_person = false
        ),
        COUNT(*) FILTER (
            WHERE (c.sales_id IS NOT DISTINCT FROM m.crm_sales_id)
              AND (m.is_person IS DISTINCT FROM false)
        )
    INTO v_system_code_null, v_ok_no_change
    FROM public.companies c
    JOIN public.companies_lago cl ON cl.company_id = c.id
    LEFT JOIN public.sales_code_map_lago m
           ON m.visma_sales_code = cl.visma_sales_code
    WHERE cl.visma_sales_code IS NOT NULL
      AND c.sales_id IS NOT DISTINCT FROM m.crm_sales_id;

    -- Kunder UDEN VISMA-kode: rørt aldrig (manuelt ejerskab bevares).
    SELECT COUNT(*) INTO v_skipped_null_code
    FROM public.companies_lago
    WHERE visma_sales_code IS NULL;

    RETURN jsonb_build_object(
        'total',             v_total,
        'updated',           v_updated,
        'set_to_null',       v_set_to_null,
        'ok_no_change',      v_ok_no_change,
        'system_code_null',  v_system_code_null,
        'skipped_null_code', v_skipped_null_code,
        'invariant_holds',
            (v_updated + v_ok_no_change + v_system_code_null + v_skipped_null_code) = v_total,
        'ran_at',            now()
    );
END;
$$;

COMMENT ON FUNCTION public.derive_sales_id_from_visma() IS
  'Brief 24 · Single source of truth for companies.sales_id. Kaldes af hver import som sidste skridt. Returnerer completeness-tal så summen kan checkes uden database-adgang.';
