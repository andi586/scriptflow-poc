alter table public.projects
add column if not exists character_images jsonb not null default '{}'::jsonb;
