-- =============================================================================
-- 20260519_create_ingestion_errors.sql
-- Dead-letter log for emotion_patterns ingestion pipeline
-- =============================================================================
-- Purpose:
--   When app/api/emotion-patterns/ingest fails (AI, validation, DB), store
--   raw input and error context for replay / debugging.
--
-- Safety: CREATE only. No DROP. Idempotent IF NOT EXISTS.
-- Apply: after 20260519_create_emotion_patterns.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  error_stage TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_errors_stage_check
    CHECK (error_stage IN ('validation', 'ai_call', 'ai_parse', 'db_insert'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_errors_created_at
  ON public.ingestion_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_errors_stage
  ON public.ingestion_errors (error_stage);

COMMENT ON TABLE public.ingestion_errors IS
  'Failed emotion_patterns ingest attempts from /api/emotion-patterns/ingest';

ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestion_errors_service_role_all"
  ON public.ingestion_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
