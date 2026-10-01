-- §95 (1. okt 2026): add 'auto-import' to sync_runs_lago.kilde constraint.
-- The postkasse-læser writes kilde='auto-import' to distinguish automated
-- runs from manual 'import' and scheduled 'vbs'.

ALTER TABLE public.sync_runs_lago
DROP CONSTRAINT sync_runs_lago_kilde_check;

ALTER TABLE public.sync_runs_lago
ADD CONSTRAINT sync_runs_lago_kilde_check
CHECK (kilde = ANY (ARRAY['import', 'vbs', 'auto-import']));
