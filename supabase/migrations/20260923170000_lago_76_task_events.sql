-- Brief 76 tillæg A (23. sep 2026) — task_events_lago
--
-- Event-log for procesdata på tasks (udskyd, send-videre, evt. senere:
-- ejer-skift, deadline-flyt). Erstatter kandidaten om at lægge
-- begrundelser i tasks.text (som send-videre gør i dag med ILIKE-match
-- på "— Sendt til kontoret DD. mmm YYYY af Fornavn Efternavn" —
-- skrøbeligt fordi sælgeren selv kan redigere teksten væk).
--
-- Nu bygges kun udskyd-veje til event-log; send-videre migreres i en
-- separat runde. Tællinger som "hvor mange gange er en aftale flyttet"
-- er en simpel COUNT(*) FILTER (WHERE event_type='udskudt') — noget
-- ingen felter i dag kan besvare.

CREATE TABLE IF NOT EXISTS public.task_events_lago (
    id              bigserial PRIMARY KEY,
    task_id         bigint NOT NULL
                    REFERENCES public.tasks(id) ON DELETE CASCADE,
    event_type      text NOT NULL
                    CHECK (event_type IN ('udskudt', 'sendt_til_kontoret')),
    event_at        timestamptz NOT NULL DEFAULT now(),
    event_af        uuid,
    note            text,
    -- Kun for udskudt: den forrige og nye due_date. Tillader
    -- rekonstruktion af historikken uden at læse tasks.due_date-historik
    -- (som ikke findes).
    udskudt_fra_dato date,
    udskudt_til_dato date
);

CREATE INDEX IF NOT EXISTS task_events_lago_task_idx
    ON public.task_events_lago (task_id, event_at DESC);
CREATE INDEX IF NOT EXISTS task_events_lago_type_idx
    ON public.task_events_lago (event_type, event_at DESC);

COMMENT ON TABLE public.task_events_lago IS
    'Brief 76 tillæg A (23. sep 2026): event-log for procesdata på tasks '
    '(udskyd, send-videre). Erstatter ILIKE-match på tasks.text som '
    'kendt skrøbelighed. Bygges én bruger ad gangen — kun udskyd i dag.';

COMMENT ON COLUMN public.task_events_lago.event_af IS
    'auth.uid() på den bruger der udførte handlingen — den, der '
    'trykkede knappen. Aldrig automatisk — der er ingen system-events.';

ALTER TABLE public.task_events_lago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read task_events_lago"
    ON public.task_events_lago;
CREATE POLICY "Authenticated read task_events_lago"
    ON public.task_events_lago FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert task_events_lago"
    ON public.task_events_lago;
CREATE POLICY "Authenticated insert task_events_lago"
    ON public.task_events_lago FOR INSERT TO authenticated
    WITH CHECK (event_af = auth.uid());
