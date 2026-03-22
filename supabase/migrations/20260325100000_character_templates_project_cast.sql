-- Per-project cast lives in character_templates: library rows keep project_id NULL.

alter table public.character_templates
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.character_templates
  add column if not exists role text,
  add column if not exists appearance text,
  add column if not exists personality text,
  add column if not exists language_fingerprint text,
  add column if not exists reference_image_path text,
  add column if not exists appears_in_beats integer[] not null default '{}'::integer[];

create index if not exists idx_character_templates_project_id
  on public.character_templates (project_id);

comment on column public.character_templates.project_id is
  'NULL = global template; non-null = copy bound to that project for generation.';
