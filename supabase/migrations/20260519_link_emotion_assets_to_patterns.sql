-- =============================================================================
-- 20260519_link_emotion_assets_to_patterns.sql
-- Link emotion_lines / emotion_details to emotion_patterns catalog
-- =============================================================================
-- Purpose:
--   Optional FK pattern_id → emotion_patterns(id) for curated lines/details
--   that map to a reusable Emotion Director pattern.
--
-- Safety:
--   - ADD COLUMN IF NOT EXISTS only (nullable, no default rewrite of rows)
--   - CREATE INDEX IF NOT EXISTS only
--   - No UPDATE / DELETE / TRUNCATE / DROP
--   - Existing rows keep pattern_id NULL until backfilled by a separate job
--
-- Prerequisites:
--   - public.emotion_patterns must exist (20260519_create_emotion_patterns.sql)
--   - public.emotion_lines and public.emotion_details must exist on target DB
--
-- Apply: staging first. Not executed by this commit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- emotion_lines.pattern_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.emotion_lines
  ADD COLUMN IF NOT EXISTS pattern_id UUID NULL
  REFERENCES public.emotion_patterns (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.emotion_lines.pattern_id IS
  'Optional link to emotion_patterns row when this line implements a catalog pattern';

CREATE INDEX IF NOT EXISTS idx_emotion_lines_pattern_id
  ON public.emotion_lines (pattern_id)
  WHERE pattern_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- emotion_details.pattern_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.emotion_details
  ADD COLUMN IF NOT EXISTS pattern_id UUID NULL
  REFERENCES public.emotion_patterns (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.emotion_details.pattern_id IS
  'Optional link to emotion_patterns row when this detail derives from a catalog pattern';

CREATE INDEX IF NOT EXISTS idx_emotion_details_pattern_id
  ON public.emotion_details (pattern_id)
  WHERE pattern_id IS NOT NULL;
