-- =============================================================================
-- 20260519_03_backfill_emotion_schema.sql
-- =============================================================================
-- Purpose:
--   Version-control DDL for Emotion OS / director catalog tables that already
--   exist on production (created manually or via dashboard) but had no CREATE
--   in supabase/migrations/. Uses remote OpenAPI snapshot (2026-05-19 audit).
--
-- Tables:
--   emotion_lines, emotion_details, director_rules, market_feedback,
--   hook_experiments, emotional_memory
-- Function:
--   boost_emotion_lines (from 20260510_create_boost_emotion_lines_function.sql)
--
-- Safety:
--   - CREATE TABLE IF NOT EXISTS only — skips if table exists, preserves all rows
--   - CREATE OR REPLACE FUNCTION — updates function body only, no table data touch
--   - No DROP TABLE / DROP COLUMN / TRUNCATE
--
-- Risk / notes:
--   - IF NOT EXISTS does not alter existing columns: if live schema differs from
--     this snapshot (extra columns, types), migration is a no-op for that table
--     and drift may remain until a follow-up ALTER migration is written.
--   - Does not seed emotion_lines / director_rules content (data unchanged).
--   - emotion_video_cache already has 20260505000001_create_emotion_video_cache.sql
--     and is omitted here.
--   - boost_emotion_lines requires emotion_lines.emotion_tags (text[]) to exist.
--
-- Apply: safe on production when tables already exist (documents schema only).
--        On fresh DBs, creates empty catalog tables for later seeding.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- emotion_lines — generate-script, emotion/generate-hook, analytics/feedback RPC
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotion_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT,
  emotion_tags TEXT[],
  why_it_hurts TEXT,
  human_detail TEXT,
  silence_score INTEGER DEFAULT 0,
  universality_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.emotion_lines IS 'Curated emotional copy lines for script/hook generation';

-- -----------------------------------------------------------------------------
-- emotion_details — generate-script, emotion/generate-hook
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotion_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT,
  emotion_tags TEXT[],
  visual_symbol TEXT,
  human_truth TEXT,
  cinematic_potential INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.emotion_details IS 'Human-detail visual symbols for emotional direction';

-- -----------------------------------------------------------------------------
-- director_rules — emotion/generate-hook, cognitive-core
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.director_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT,
  rule TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.director_rules IS 'Director constraint rules for hook blueprint generation';

-- -----------------------------------------------------------------------------
-- market_feedback — analytics/feedback, analytics/watch
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hook_experiment_id UUID,
  watch_time NUMERIC,
  rewatch_rate NUMERIC,
  comments JSONB,
  conversion_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.market_feedback IS 'User reaction signals for market tuning';

-- -----------------------------------------------------------------------------
-- hook_experiments — emotion/generate-hook
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hook_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT,
  user_input TEXT,
  hook_blueprint JSONB,
  score JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.hook_experiments IS 'Stored hook blueprints and scores for A/B style iteration';

-- -----------------------------------------------------------------------------
-- emotional_memory — movie/generate (long-horizon story memory)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotional_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT,
  movie_id UUID,
  characters JSONB,
  visual_symbols JSONB,
  unspoken_things JSONB,
  emotional_debt JSONB,
  pending_callbacks JSONB,
  format_type TEXT DEFAULT 'hook_15s',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.emotional_memory IS 'Per-movie emotional memory for foreshadowing and symbols';

-- -----------------------------------------------------------------------------
-- boost_emotion_lines — analytics/feedback → emotion_lines.universality_score
-- Snapshot from: supabase/migrations/20260510_create_boost_emotion_lines_function.sql
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boost_emotion_lines(archetype TEXT, boost_amount INT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.emotion_lines
  SET universality_score = LEAST(10, universality_score + boost_amount)
  WHERE emotion_tags && ARRAY[archetype]::text[];
END;
$$;

COMMENT ON FUNCTION public.boost_emotion_lines IS
  'Boosts universality_score for emotion lines matching archetype (cap 10).';
