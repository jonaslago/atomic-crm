-- Brief 84 §3 (28. sep 2026) — completed_by_sales_id på tasks
--
-- Under dækning kan Simon markere Camillas opgave som klaret. Uden
-- denne kolonne ved historikken kun at opgaven blev lukket kl. 14:35,
-- ikke at Simon var den handlende. done_date findes allerede som
-- completion-tidsstempel; kun feltet "hvem lukkede den" mangler, så
-- briefens completed_at behøver vi ikke tilføje.
--
-- Ingen backfill: NULL på eksisterende rækker er ærligt "vi ved det
-- ikke" (samme princip som brief 64 for created_at). At gætte "det
-- var opgavens tildelte sælger" ville lave et gæt om til fakta.
--
-- sales_id (tildelt) røres ikke af briefen — Camilla er syg, ikke
-- væk. Opgaven forbliver hendes; completed_by_sales_id fortæller
-- hvem der dækkede for hende, mens hun var det.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS completed_by_sales_id bigint
        REFERENCES public.sales(id);

COMMENT ON COLUMN public.tasks.completed_by_sales_id IS
    'Brief 84 (28. sep 2026): hvem klarede opgaven. Sat af UI ved '
    'markér-klaret, i egen og dækket portefølje. NULL for rækker '
    'lukket før 28. sep 2026. sales_id (tildelt) røres ikke — bliver '
    'stående så en syg kollega kan se hvem der tog over.';
