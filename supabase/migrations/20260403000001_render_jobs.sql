-- render_jobs: async pipeline job queue for Kling prompt generation + submission
-- Each row tracks one full pipeline run (analyze → prompts → submit Kling)
-- so the frontend can poll status without keeping the HTTP connection open.

CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'queued',
  progress int NOT NULL DEFAULT 0,
  input_json jsonb NOT NULL DEFAULT '{}',
  output_json jsonb NULL,
  error_message text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_user ON render_jobs(user_id);

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own jobs" ON render_jobs
  FOR ALL USING (auth.uid() = user_id);
