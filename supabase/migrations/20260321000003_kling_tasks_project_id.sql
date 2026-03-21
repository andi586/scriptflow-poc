-- Scope Kling tasks per project (avoid cross-project scene_index collisions)

alter table kling_tasks
  add column if not exists project_id uuid references projects (id) on delete cascade;

create index if not exists idx_kling_tasks_project_scene
  on kling_tasks (project_id, scene_index);

create index if not exists idx_kling_tasks_project_status
  on kling_tasks (project_id, status);
