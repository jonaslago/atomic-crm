-- §95-1 (1. okt 2026): transactional replacement of open_orders_lago
-- and open_order_notes_lago.
--
-- Called from executeImport.ts (manual import) and will be called from
-- auto-import once the server-side importer is wired up.
--
-- The function runs as SECURITY DEFINER so it bypasses RLS — the caller
-- is already admin-gated in the application layer. It:
--   1. DELETEs all rows from both tables
--   2. INSERTs the new rows from the JSONB arrays
--   3. Returns the counts
--
-- If any INSERT fails (e.g. a row with an invalid date), the entire
-- transaction rolls back — the DELETEs are undone, old data stays.

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

-- Grant execute to authenticated (the function is SECURITY DEFINER,
-- so it runs with the owner's privileges regardless of RLS).
GRANT EXECUTE ON FUNCTION public.replace_open_orders(jsonb, jsonb)
    TO authenticated;
