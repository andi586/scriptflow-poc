-- =============================================================================
-- 20260519_02_fix_kling_jobs_columns.sql
-- =============================================================================
-- Purpose:
--   Add columns expected by app/api/cron/process-kling/route.ts that are absent
--   on the current kling_jobs table (remote had: id, movie_id, shot_index,
--   prompt, status, kling_task_id, result_url, created_at only).
--
-- Columns added:
--   scene_video_url, result_video_url, shotstack_render_id, task_id, updated_at
--
-- Safety:
--   - ADD COLUMN IF NOT EXISTS only (no DROP, no data changes)
--   - Existing rows keep result_url; new code paths use result_video_url
--   - Idempotent: safe to re-run
--
-- Risk / notes:
--   - Does not migrate data from result_url → result_video_url; cron may need
--     both populated until backfill is done manually if legacy rows exist.
--   - prompt column may already exist on remote; IF NOT EXISTS skips duplicate.
--   - Run after kling_jobs table exists (it is already on remote).
--   - Unrelated to profiles/payments (see 20260519_01) or emotion tables (03).
--
-- Apply: staging first, then production. Do not run against prod without review.
-- =============================================================================

ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS scene_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS result_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS shotstack_render_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.kling_jobs.scene_video_url IS 'Kling scene/background video URL for concat with face video';
COMMENT ON COLUMN public.kling_jobs.result_video_url IS 'Face/video output URL (app code; legacy column may be result_url)';
COMMENT ON COLUMN public.kling_jobs.shotstack_render_id IS 'Shotstack render job id when merging scene + face';
COMMENT ON COLUMN public.kling_jobs.task_id IS 'External task correlation id (e.g. push notification jobId)';
COMMENT ON COLUMN public.kling_jobs.updated_at IS 'Last status update for cron polling';
