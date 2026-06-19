-- LAGO: audit trail for every AI call (Fase 0 del B).
-- Hand-trimmed from `supabase db diff --local -f lago_llm_calls`: grants
-- regenerated for unrelated upstream tables (companies, contacts, sales, etc.)
-- were stripped because they are pre-existing drift between
-- supabase/schemas/06_grants.sql and the introspected DB state, not part of
-- this LAGO change. Only llm_calls-related DDL remains.

create sequence "public"."llm_calls_id_seq";

create table "public"."llm_calls" (
    "id" bigint not null default nextval('public.llm_calls_id_seq'::regclass),
    "provider" text not null,
    "model" text not null,
    "prompt_version" text not null,
    "input_tokens" integer,
    "output_tokens" integer,
    "latency_ms" integer,
    "cost_estimate_dkk" numeric(10, 4),
    "user_id" uuid,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."llm_calls" enable row level security;

alter sequence "public"."llm_calls_id_seq" owned by "public"."llm_calls"."id";

CREATE INDEX llm_calls_created_at_idx ON public.llm_calls USING btree (created_at DESC);
CREATE INDEX llm_calls_user_id_idx ON public.llm_calls USING btree (user_id);
CREATE UNIQUE INDEX llm_calls_pkey ON public.llm_calls USING btree (id);

alter table "public"."llm_calls"
    add constraint "llm_calls_pkey" PRIMARY KEY using index "llm_calls_pkey";

alter table "public"."llm_calls"
    add constraint "llm_calls_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
    not valid;

alter table "public"."llm_calls" validate constraint "llm_calls_user_id_fkey";

-- Grants follow the upstream-wide pattern (broad grants; RLS does the gating).
grant delete, insert, references, select, trigger, truncate, update
    on table "public"."llm_calls" to "anon";
grant delete, insert, references, select, trigger, truncate, update
    on table "public"."llm_calls" to "authenticated";
grant delete, insert, references, select, trigger, truncate, update
    on table "public"."llm_calls" to "service_role";

create policy "Users read their own AI calls"
    on "public"."llm_calls"
    as permissive
    for select
    to authenticated
    using ((auth.uid() = user_id));
