-- =============================================================================
-- 20260519_create_emotion_patterns.sql
-- ScriptFlow · AI Emotion Director — emotion_patterns abstraction layer
-- =============================================================================
-- Purpose:
--   Canonical store for reusable emotional/viral narrative mechanisms used by the
--   Emotion Director system: viral hooks, golden lines, comment memes, dark humor,
--   counter-expectation beats, reversals, moral misalignment, retention mechanics.
--
-- Safety:
--   - CREATE only; no DROP TABLE / DROP COLUMN / TRUNCATE
--   - Idempotent table/index creation (IF NOT EXISTS)
--
-- Risk:
--   - Seed INSERT uses fixed UUID; re-run skips duplicate via ON CONFLICT DO NOTHING
--   - RLS allows public SELECT (anon) for catalog reads — restrict if data is private
--
-- Apply: review on staging first. Not auto-executed by this repo commit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: emotion_patterns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emotion_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL,
  category TEXT NOT NULL,
  setup_structure TEXT,
  reversal_structure TEXT,
  emotion_trigger TEXT,
  retention_trigger TEXT,
  viral_mechanism TEXT[] NOT NULL DEFAULT '{}',
  cognitive_pattern TEXT,
  example_text TEXT,
  example_analysis TEXT,
  platform TEXT,
  language TEXT NOT NULL DEFAULT 'zh',
  universality_score NUMERIC(4, 2) DEFAULT 0,
  shareability_score NUMERIC(4, 2) DEFAULT 0,
  watchtime_score NUMERIC(4, 2) DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT emotion_patterns_universality_range
    CHECK (universality_score >= 0 AND universality_score <= 10),
  CONSTRAINT emotion_patterns_shareability_range
    CHECK (shareability_score >= 0 AND shareability_score <= 10),
  CONSTRAINT emotion_patterns_watchtime_range
    CHECK (watchtime_score >= 0 AND watchtime_score <= 10)
);

COMMENT ON TABLE public.emotion_patterns IS
  'AI Emotion Director pattern library: hooks, golden lines, comment memes, reversals, retention mechanics';

COMMENT ON COLUMN public.emotion_patterns.pattern_name IS 'Human-readable pattern title';
COMMENT ON COLUMN public.emotion_patterns.category IS
  'Pattern family: e.g. viral_hook, golden_line, comment_reply, dark_humor, counter_expectation, emotion_reversal, moral_misalignment, retention_mechanic';
COMMENT ON COLUMN public.emotion_patterns.setup_structure IS 'How tension/context is established';
COMMENT ON COLUMN public.emotion_patterns.reversal_structure IS 'How expectation is broken or reframed';
COMMENT ON COLUMN public.emotion_patterns.emotion_trigger IS 'Primary feeling activated in the audience';
COMMENT ON COLUMN public.emotion_patterns.retention_trigger IS 'Why the viewer keeps watching';
COMMENT ON COLUMN public.emotion_patterns.viral_mechanism IS
  'Machine tags: expectation_collapse, moral_reversal, absurd_humor, etc.';
COMMENT ON COLUMN public.emotion_patterns.cognitive_pattern IS 'Underlying mental model / frame shift';
COMMENT ON COLUMN public.emotion_patterns.example_text IS 'Canonical example copy';
COMMENT ON COLUMN public.emotion_patterns.example_analysis IS 'Director notes on why it works';
COMMENT ON COLUMN public.emotion_patterns.platform IS 'Origin platform: tiktok, douyin, youtube, etc.';
COMMENT ON COLUMN public.emotion_patterns.language IS 'ISO-ish language code: zh, en, …';
COMMENT ON COLUMN public.emotion_patterns.source_type IS
  'Provenance: comment, hook, script, manual, benchmark, …';

-- -----------------------------------------------------------------------------
-- Indexes (required + query helpers)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_emotion_patterns_category
  ON public.emotion_patterns (category);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_tags
  ON public.emotion_patterns USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_viral_mechanism
  ON public.emotion_patterns USING GIN (viral_mechanism);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_universality_score
  ON public.emotion_patterns (universality_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_created_at
  ON public.emotion_patterns (created_at DESC);

-- Composite: top patterns per category for director ranking
CREATE INDEX IF NOT EXISTS idx_emotion_patterns_category_universality
  ON public.emotion_patterns (category, universality_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_emotion_patterns_language
  ON public.emotion_patterns (language);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.emotion_patterns ENABLE ROW LEVEL SECURITY;

-- Catalog read for hook/script generation (anon + logged-in clients via API)
CREATE POLICY "emotion_patterns_select_catalog"
  ON public.emotion_patterns
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Writes reserved for service role (seeds, admin tools, batch imports)
CREATE POLICY "emotion_patterns_service_role_all"
  ON public.emotion_patterns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional: authenticated curators may insert drafts (disable if unused)
CREATE POLICY "emotion_patterns_authenticated_insert"
  ON public.emotion_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Seed: Moral Reversal Dark Humor (fixed id for idempotent re-runs)
-- -----------------------------------------------------------------------------
INSERT INTO public.emotion_patterns (
  id,
  pattern_name,
  category,
  setup_structure,
  reversal_structure,
  emotion_trigger,
  retention_trigger,
  viral_mechanism,
  cognitive_pattern,
  example_text,
  example_analysis,
  platform,
  language,
  universality_score,
  shareability_score,
  watchtime_score,
  tags,
  source_type
) VALUES (
  'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  'Moral Reversal Dark Humor',
  'dark_humor_reversal',
  '道德施压',
  '荒诞逻辑反转',
  '观众预期对方会愧疚',
  '认知预测崩塌',
  ARRAY['expectation_collapse', 'moral_reversal', 'absurd_humor']::TEXT[],
  '先建立严肃道德框架，再突然改变语义解释路径',
  $example$你吃鸡的时候有没有想过他们也有爸爸妈妈？
我想过，但我一次吃不了那么多。$example$,
  '观众预期角色进入道德反思，但回答者通过故意误解“鸡”的含义，把道德审判反向劫持，形成黑色幽默与认知爆炸。',
  'tiktok',
  'zh',
  9.2,
  8.8,
  8.5,
  ARRAY['黑色幽默', '反预期', '道德绑架反杀', '认知错位']::TEXT[],
  'comment'
)
ON CONFLICT (id) DO NOTHING;
