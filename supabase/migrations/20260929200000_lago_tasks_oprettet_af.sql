-- §13 (29. sep 2026): oprettet_af på tasks.
--
-- Brief 84 §1's banner lover brugeren: "Alt, du registrerer, står i dit
-- navn". Under dækning skal det være ejerens (den handlende Simon), ikke
-- den passede (Camilla). Task-tabellen har ingen kolonne der lever op
-- til det løftet — origin er kun 'ai'/'manual'/NULL, created_at er
-- uden actor.
--
-- Efterregistrér ikke — vi ved ikke hvem der lavede de eksisterende
-- opgaver. Loggen begynder her, samme princip som sletninger_lago (29.
-- sep).
--
-- Sammenhæng: tasks.oprettet_af (nyt) + sletninger_lago (28. sep) er
-- samme hul set fra hver sin ende: hvem lavede den, og hvem fjernede
-- den. En senere completed_by_sales_id-kolonne (brief 84 §3) lukker
-- den midterste udgang: hvem lukkede den.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS oprettet_af bigint REFERENCES public.sales(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.oprettet_af IS
'§13 (29. sep 2026): sales.id på den der oprettede opgaven. Under dækning: actorSalesId (den handlende), ikke viewSalesId (den passede). Sat ved oprettelse — efterregistreres ikke.';

CREATE INDEX IF NOT EXISTS tasks_oprettet_af_idx
    ON public.tasks (oprettet_af)
    WHERE oprettet_af IS NOT NULL;
