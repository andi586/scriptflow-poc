-- omnihuman_jobs: tracks OmniHuman video generation tasks via PiAPI webhook
-- Each row represents one OmniHuman task submitted to PiAPI.
-- The webhook at /api/omnihuman-webhook updates status and result_video_url.

CREATE TABLE IF NOT EXISTS omnihuman_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT,
  task_id TEXT,
  status TEXT DEFAULT 'pending',
  result_video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnihuman_jobs_project_id ON omnihuman_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_omnihuman_jobs_task_id ON omnihuman_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_omnihuman_jobs_status ON omnihuman_jobs(status);
