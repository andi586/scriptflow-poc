-- Fix PGRST204: missing columns on story_memory (older / hand-created DBs)
-- Run in Supabase SQL Editor if migrations were not applied.

alter table public.story_memory
  add column if not exists causal_result_frames jsonb not null default '[]'::jsonb,
  add column if not exists prop_states jsonb not null default '[]'::jsonb,
  add column if not exists foreshadowing_map jsonb not null default '[]'::jsonb;

-- analyzeScriptAction also upserts prop_registry (separate from prop_states)
alter table public.story_memory
  add column if not exists prop_registry jsonb not null default '[]'::jsonb;
