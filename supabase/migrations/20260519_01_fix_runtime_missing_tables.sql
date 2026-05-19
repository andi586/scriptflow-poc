-- =============================================================================
-- 20260519_01_fix_runtime_missing_tables.sql
-- =============================================================================
-- Purpose:
--   Create tables that are referenced in application code but missing on the
--   current Supabase project (PostgREST 404). Without these, runtime paths fail
--   immediately (Stripe webhook, credits page, episode orchestrator).
--
-- Tables (all missing on remote at audit time):
--   profiles, payments, shots, dialogue_lines, generation_runs
--
-- Safety:
--   - CREATE TABLE IF NOT EXISTS only (no DROP, no TRUNCATE, no DELETE)
--   - No column drops or type changes on existing tables
--   - Idempotent: safe to re-run if a table already exists
--
-- Risk / notes:
--   - profiles.id REFERENCES auth.users(id): migration succeeds only if
--     auth.users rows exist for any profile inserts; empty table is fine.
--   - payments.movie_id REFERENCES movies(id): requires movies table (already
--     on remote). Orphan movie_id values in future inserts will fail FK check.
--   - shots / dialogue_lines / generation_runs reference projects(id).
--   - After this file, still apply add_user_credits.sql (or equivalent) for
--     increment_user_credits() if that RPC is not yet on the database.
--   - Does NOT fix kling_jobs column drift (see 20260519_02).
--   - Does NOT version-control emotion catalog tables (see 20260519_03).
--
-- Apply: staging first, then production. Do not run against prod without review.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — Stripe checkout/webhook, app/credits/page.tsx
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 0,
  subscription_tier TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_credits ON public.profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

COMMENT ON TABLE public.profiles IS 'Per-user billing and subscription metadata (extends auth.users)';

-- -----------------------------------------------------------------------------
-- payments — app/api/stripe/webhook/route.ts (insert after movie checkout)
-- Snapshot from: supabase/migrations/20260509_create_payments_table.sql
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID REFERENCES public.movies(id),
  user_id TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_movie_id ON public.payments(movie_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON public.payments(stripe_session_id);

-- -----------------------------------------------------------------------------
-- shots — lib/orchestrators/episode-orchestrator.ts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  kling_prompt TEXT NOT NULL DEFAULT '',
  kling_task_id TEXT,
  video_url TEXT,
  video_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT shots_project_shot_index_unique UNIQUE (project_id, shot_index)
);

CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);

-- -----------------------------------------------------------------------------
-- dialogue_lines — lib/orchestrators/episode-orchestrator.ts (TTS pipeline)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dialogue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  line_index INTEGER NOT NULL,
  character TEXT NOT NULL,
  text TEXT NOT NULL,
  emotion TEXT,
  voice_id TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  tts_status TEXT NOT NULL DEFAULT 'pending',
  start_sec NUMERIC,
  duration_sec NUMERIC,
  timestamps_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT dialogue_lines_project_shot_line_unique UNIQUE (project_id, shot_index, line_index)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_lines_project_id ON public.dialogue_lines(project_id);

-- -----------------------------------------------------------------------------
-- generation_runs — lib/orchestrators/episode-orchestrator.ts (job state)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_runs (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  video_status TEXT NOT NULL DEFAULT 'pending',
  tts_status TEXT NOT NULL DEFAULT 'pending',
  merge_status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  merge_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
