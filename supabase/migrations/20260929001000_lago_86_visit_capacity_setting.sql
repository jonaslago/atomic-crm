-- Brief 86 §6 opfølgning (28. sep 2026): kapacitetsantagelser til
-- Kapacitets-tjekket. Formel (kickoff): saelgere × feltdage_per_uge ×
-- besoeg_per_dag × uger_per_aar × (1 − reserve_pct/100).
--
-- Værdierne skal kunne rettes af Ole i Indstillinger uden deploy — det
-- er hele pointen med tjekket. Første version bruger kickoff-antagelserne:
-- 2 sælgere, 4 feltdage/uge, 5 besøg/dag, 45 uger/år, 15 % reserve til
-- leads og fri kalender.
--
-- ON CONFLICT DO NOTHING så gentagne runs ikke overskriver Oles egne
-- justeringer bagefter.

INSERT INTO public.lago_settings(key, value)
VALUES (
    'visit_capacity',
    '{"saelgere": 2, "feltdage_per_uge": 4, "besoeg_per_dag": 5, "uger_per_aar": 45, "reserve_pct": 15}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
