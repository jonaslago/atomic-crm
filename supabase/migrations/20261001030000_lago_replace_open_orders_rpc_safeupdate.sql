-- Fix: add WHERE true to satisfy pg_safeupdate extension.
-- pg_safeupdate blocks unconditional DELETE/UPDATE even inside plpgsql.

CREATE OR REPLACE FUNCTION public.replace_open_orders(
    p_orders jsonb,
    p_notes  jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_orders_inserted int;
    v_notes_inserted  int;
BEGIN
    -- 1. Delete all existing rows (notes first — no FK but logically dependent)
    -- WHERE true satisfies pg_safeupdate which blocks unconditional DELETE/UPDATE.
    DELETE FROM open_order_notes_lago WHERE true;
    DELETE FROM open_orders_lago WHERE true;

    -- 2. Insert orders
    INSERT INTO open_orders_lago (
        ordre_nr, linje_nr, visma_customer_no, ordre_dato,
        ordreart, status, kampagne, saelger,
        produktnr, produktgruppe, kundeprisgruppe, salgstype,
        antal, rest, i_rest, ej_faktureret,
        oensket_leveringsdato, faerdigmeldingsdato, sellerno,
        levering, antal_faerdigmeldt, reserveret_mod_lager,
        lagerstatus, mav, har_oensket_dato, forbrugt,
        note, undtages_lagerhaandtering,
        er_testdata, kilde, synced_at
    )
    SELECT
        r->>'ordre_nr',
        r->>'linje_nr',
        r->>'visma_customer_no',
        (r->>'ordre_dato')::date,
        r->>'ordreart',
        r->>'status',
        r->>'kampagne',
        r->>'saelger',
        r->>'produktnr',
        r->>'produktgruppe',
        r->>'kundeprisgruppe',
        r->>'salgstype',
        (r->>'antal')::numeric,
        (r->>'rest')::numeric,
        (r->>'i_rest')::numeric,
        COALESCE((r->>'ej_faktureret')::numeric, 0),
        (r->>'oensket_leveringsdato')::date,
        (r->>'faerdigmeldingsdato')::date,
        r->>'sellerno',
        r->>'levering',
        (r->>'antal_faerdigmeldt')::numeric,
        (r->>'reserveret_mod_lager')::numeric,
        r->>'lagerstatus',
        (r->>'mav')::boolean,
        (r->>'har_oensket_dato')::boolean,
        (r->>'forbrugt')::numeric,
        r->>'note',
        COALESCE((r->>'undtages_lagerhaandtering')::boolean, false),
        COALESCE((r->>'er_testdata')::boolean, true),
        COALESCE(r->>'kilde', 'import'),
        now()
    FROM jsonb_array_elements(p_orders) AS r;

    GET DIAGNOSTICS v_orders_inserted = ROW_COUNT;

    -- 3. Insert notes (may be empty — that is fine)
    INSERT INTO open_order_notes_lago (
        ordre_nr, linje_nr, produktnr, note_type,
        beskrivelse, aendret_dato, synced_at
    )
    SELECT
        r->>'ordre_nr',
        r->>'linje_nr',
        r->>'produktnr',
        r->>'note_type',
        r->>'beskrivelse',
        (r->>'aendret_dato')::date,
        now()
    FROM jsonb_array_elements(p_notes) AS r;

    GET DIAGNOSTICS v_notes_inserted = ROW_COUNT;

    RETURN jsonb_build_object(
        'orders_inserted', v_orders_inserted,
        'notes_inserted',  v_notes_inserted
    );
END;
$$;
