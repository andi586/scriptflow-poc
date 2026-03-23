-- Track which generation model handled each scene task (kling / veo3).

alter table public.kling_tasks
  add column if not exists model_used text;

