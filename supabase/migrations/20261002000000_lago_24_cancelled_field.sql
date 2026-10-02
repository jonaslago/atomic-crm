-- §24 (2. okt 2026): cancelled field on customer_activities_lago.
--
-- done=false now means two things: an overdue plan and a cancelled visit.
-- cancelled separates the two. A cancelled activity is neither completed
-- nor an open plan — it is a decision that the visit did not happen.
--
-- No UI action for cancelling yet. The field exists so the meaning is
-- written in the schema instead of guessed from source.

ALTER TABLE public.customer_activities_lago
    ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;

-- The three VISMA-imported activities with done=false are cancelled visits,
-- not overdue plans.
UPDATE public.customer_activities_lago
SET cancelled = true
WHERE id IN (1022, 494, 53)
  AND source = 'visma_import'
  AND done = false;
