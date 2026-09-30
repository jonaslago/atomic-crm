-- Brief 84 tillæg A §2 (28. sep 2026) — 'klaret' som event-type
--
-- task_events_lago holdt kun procesdata (udskudt, sendt_til_kontoret).
-- "Klaret" hører hjemme her: samme tabel, samme event_af (auth.uid()),
-- samme index. tasks.completed_by_sales_id svarer på "hvem klarede
-- den" for UI'et; eventen svarer på "hvad er der sket med denne
-- opgave" for historikken. Briefen kræver begge dele — tilstand og
-- log — og vi har allerede valgt begge dele andre steder (task-
-- statusflip: due_date + task_events_lago; besøg: done_flag +
-- customer_activities_lago).

ALTER TABLE public.task_events_lago
    DROP CONSTRAINT IF EXISTS task_events_lago_event_type_check;

ALTER TABLE public.task_events_lago
    ADD CONSTRAINT task_events_lago_event_type_check
    CHECK (event_type IN ('udskudt', 'sendt_til_kontoret', 'klaret'));

COMMENT ON COLUMN public.task_events_lago.event_type IS
    'udskudt | sendt_til_kontoret | klaret. Klaret (brief 84) dækker '
    'både egen og dækket portefølje — event_af peger på den handlende, '
    'som altid.';
