-- Brief 40 tillæg A + B (16. sep 2026): eksplicit origin-felt på tasks.
--
-- Tidligere hvilede AI-vs-manuel-skelnen på fravær af ai_llm_call_id,
-- kombineret med type='follow-up'. Begge stier skriver dog samme type,
-- og et fravær er en definition-ved-negativ som fanger enhver fremtidig
-- indgang der ikke er tænkt endnu. Feltet gør oprindelsen positiv.
--
-- Værdier (klienten skriver):
--   'ai'      — genereret af LLM'en og accepteret (evt. redigeret) af
--                sælgeren via ForslagListe. ai_llm_call_id sættes stadig
--                for målings-sporet i brief 21 tillæg A.
--   'manual'  — sælgeren skrev opfølgningen selv i FollowUpBuilder eller
--                QuickTaskForm.
--   NULL      — eksisterende data + tasks skabt via andre indgange
--                (fx OpgaveForm i Registrér-modalen, opgaver oprettet fra
--                kontaktsiden). Vi ved allerede hvad de er; kolonnen
--                efterlader vinduet åbent til at klassificere dem
--                senere hvis der bliver behov.
--
-- Ingen constraint — hvis vi tilføjer en ny værdi senere ('legacy_seed',
-- 'ai_edge_function_v2' osv.), skal migrationen ikke ændres. Rapporten
-- filtrerer på origin='ai' eller origin='manual'.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS origin text;

-- Kommentar til fremtidige læsere (via psql \d+ og pg_dump).
COMMENT ON COLUMN public.tasks.origin IS
    'Brief 40 tillæg A/B: eksplicit oprindelse — ''ai'' | ''manual'' | NULL (ukendt/legacy).';
