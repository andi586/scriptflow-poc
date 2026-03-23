-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- kling_tasks: persist PiAPI task_id per scene to avoid duplicates

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

create table kling_tasks (
  id uuid default gen_random_uuid() primary key,
  task_id text unique not null,
  scene_index int,
  status text default 'processing',
  video_url text,
  error_message text,
  created_at timestamp default now()
);

