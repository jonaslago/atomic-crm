-- Brief 84 opfølgning C (28. sep 2026) — 'genaabnet' som event-type
--
-- Uden denne event vil Fortryd på klaret-markering skabe en
-- inkonsistens: tasks.done_date sættes tilbage til NULL, men
-- task_events_lago har stadig 'klaret'-eventen fra klik'et. Læses
-- loggen forfra, siger den at opgaven er klaret; tilstanden siger
-- åben. En log der modsiger tilstanden er værre end ingen log.
--
-- Løsningen: Fortryd skriver 'genaabnet' som selvstændig event.
-- Læses loggen så forfra som "Simon klarede 14:35:00 · Simon
-- genåbnede 14:35:03" — sandt og fuldt, uden modsigelse.

ALTER TABLE public.task_events_lago
    DROP CONSTRAINT IF EXISTS task_events_lago_event_type_check;

ALTER TABLE public.task_events_lago
    ADD CONSTRAINT task_events_lago_event_type_check
    CHECK (event_type IN ('udskudt', 'sendt_til_kontoret', 'klaret', 'genaabnet'));

COMMENT ON COLUMN public.task_events_lago.event_type IS
    'udskudt | sendt_til_kontoret | klaret | genaabnet. '
    'Genaabnet skrives ved Fortryd på klaret-markering (brief 84 '
    'opfølgning C, 28. sep 2026) — så loggen kan læses forfra uden '
    'at modsige tilstanden.';
