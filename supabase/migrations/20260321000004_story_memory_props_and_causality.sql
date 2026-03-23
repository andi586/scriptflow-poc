-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- F67 + F66: persist prop lock profile and physical causality static-result map

alter table story_memory
  add column if not exists prop_registry jsonb not null default '[]'::jsonb;

alter table story_memory
  add column if not exists causal_result_frames jsonb not null default '[]'::jsonb;
