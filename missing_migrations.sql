-- missing_migrations.sql
-- Generated: 2026-05-19T01:42:25.036Z
-- Target: https://ktrtheitjtwpdvdvnlzj.supabase.co
-- Apply via: npm run db:migrate (DATABASE_URL) or Supabase SQL editor

-- =============================================================================
-- SECTION A: Existing repo migrations not yet applied on remote
-- =============================================================================
-- >>> from 20260507_create_expression_assets.sql
-- Create expression_assets table for caching Seedance emotion videos
CREATE TABLE IF NOT EXISTS expression_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  project_id TEXT,
  expression TEXT NOT NULL,
  source_photo_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups by photo URL and expression
CREATE INDEX IF NOT EXISTS idx_expression_assets_photo_expression 
  ON expression_assets(source_photo_url, expression);

-- Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_expression_assets_user_id 
  ON expression_assets(user_id);

-- Add index for project_id lookups
CREATE INDEX IF NOT EXISTS idx_expression_assets_project_id 
  ON expression_assets(project_id);

-- Add comment
COMMENT ON TABLE expression_assets IS 'Caches Seedance emotion videos to avoid regenerating the same expression for the same photo';

-- >>> from 20260509_create_payments_table.sql
-- Create payments table for tracking Stripe payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID REFERENCES movies(id),
  user_id TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_movie_id ON payments(movie_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON payments(stripe_session_id);

-- =============================================================================
-- SECTION B: Tables referenced in code but missing CREATE in supabase/migrations/
-- =============================================================================
-- Snapshot from remote OpenAPI (dialogue_blocks)
CREATE TABLE IF NOT EXISTS public.dialogue_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_id UUID,
  project_id UUID,
  character TEXT,
  text TEXT,
  emotion TEXT DEFAULT 'neutral',
  voice_id TEXT,
  start_sec NUMERIC,
  end_sec NUMERIC,
  audio_url TEXT,
  timestamps_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dialogue_lines: TTS pipeline per shot line
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
  UNIQUE (project_id, shot_index, line_index)
);
CREATE INDEX IF NOT EXISTS idx_dialogue_lines_project_id ON public.dialogue_lines(project_id);

-- Snapshot from remote OpenAPI (digital_twins)
CREATE TABLE IF NOT EXISTS public.digital_twins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  frame_url_front TEXT,
  frame_url_mid TEXT,
  frame_url_side TEXT,
  source_video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  voice_id TEXT,
  cached_videos JSONB
);

-- Snapshot from remote OpenAPI (director_rules)
CREATE TABLE IF NOT EXISTS public.director_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT,
  rule TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot from remote OpenAPI (emotion_details)
CREATE TABLE IF NOT EXISTS public.emotion_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT,
  emotion_tags TEXT[],
  visual_symbol TEXT,
  human_truth TEXT,
  cinematic_potential INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot from remote OpenAPI (emotion_lines)
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

-- Snapshot from remote OpenAPI (emotional_memory)
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

-- generation_runs: tracks video/tts/merge job state per project
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

-- Snapshot from remote OpenAPI (hook_experiments)
CREATE TABLE IF NOT EXISTS public.hook_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT,
  user_input TEXT,
  hook_blueprint JSONB,
  score JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- kling_jobs: table exists on remote; see SECTION C for column ALTERs only
-- Snapshot from remote OpenAPI (market_assets)
CREATE TABLE IF NOT EXISTS public.market_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID,
  project_id UUID,
  type TEXT,
  title TEXT,
  description TEXT,
  price_cents INTEGER DEFAULT 999,
  status TEXT DEFAULT 'active',
  asset_data JSONB,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot from remote OpenAPI (market_feedback)
CREATE TABLE IF NOT EXISTS public.market_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hook_experiment_id UUID,
  watch_time NUMERIC,
  rewatch_rate NUMERIC,
  comments JSONB,
  conversion_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- movie_shots: only ALTER migrations exist in repo; CREATE from remote OpenAPI snapshot
CREATE TABLE IF NOT EXISTS public.movie_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID,
  shot_index INTEGER,
  omni_task_id TEXT,
  kling_task_id TEXT,
  omni_video_url TEXT,
  kling_scene_url TEXT,
  final_shot_url TEXT,
  audio_url TEXT,
  status TEXT DEFAULT 'pending',
  shotstack_render_id TEXT,
  narrative JSONB,
  shot_type TEXT DEFAULT 'face',
  duration NUMERIC,
  retry_count INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  error TEXT,
  user_id UUID,
  twin_frame_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_shots_status_updated_at ON public.movie_shots(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_movie_shots_movie_id ON public.movie_shots(movie_id);

-- Snapshot from remote OpenAPI (music_assets)
CREATE TABLE IF NOT EXISTS public.music_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  url TEXT,
  preview_url TEXT,
  cover_url TEXT,
  emotion_tags TEXT[],
  mood TEXT,
  genre TEXT,
  language TEXT DEFAULT 'instrumental',
  source TEXT DEFAULT 'pixabay',
  external_id TEXT,
  creator_id UUID,
  creator_name TEXT,
  status TEXT DEFAULT 'free',
  price_credits INTEGER DEFAULT 0,
  revenue_share NUMERIC DEFAULT 0.8,
  plays INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  uses_in_movies INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  duration INTEGER,
  bpm INTEGER,
  key TEXT,
  format TEXT DEFAULT 'mp3',
  approved BOOLEAN DEFAULT true,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  valence NUMERIC DEFAULT 0.5,
  arousal NUMERIC DEFAULT 0.5,
  warmth NUMERIC DEFAULT 0.5,
  playfulness NUMERIC DEFAULT 0.3,
  darkness NUMERIC DEFAULT 0.1,
  tension NUMERIC DEFAULT 0.2,
  pacing TEXT DEFAULT 'medium',
  suitable_for_characters TEXT[],
  suitable_for_settings TEXT[],
  unsuitable_for TEXT[],
  editorial_quality_score INTEGER DEFAULT 70
);

-- profiles: extends auth.users (required by Stripe webhook + credits)
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

-- Snapshot from remote OpenAPI (push_subscriptions)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT,
  endpoint TEXT,
  keys JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot from remote OpenAPI (script_edits)
CREATE TABLE IF NOT EXISTS public.script_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,
  episode_index INTEGER,
  line_index INTEGER,
  original_line JSONB,
  edited_line JSONB,
  status TEXT DEFAULT 'edited',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- shots: episode pipeline (lib/orchestrators/episode-orchestrator.ts)
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
  UNIQUE (project_id, shot_index)
);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);

-- =============================================================================
-- SECTION C: ALTER-only tables / column alignment
-- =============================================================================
-- movie_shots: only ALTER migrations exist in repo; CREATE from remote OpenAPI snapshot
CREATE TABLE IF NOT EXISTS public.movie_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID,
  shot_index INTEGER,
  omni_task_id TEXT,
  kling_task_id TEXT,
  omni_video_url TEXT,
  kling_scene_url TEXT,
  final_shot_url TEXT,
  audio_url TEXT,
  status TEXT DEFAULT 'pending',
  shotstack_render_id TEXT,
  narrative JSONB,
  shot_type TEXT DEFAULT 'face',
  duration NUMERIC,
  retry_count INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  error TEXT,
  user_id UUID,
  twin_frame_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_shots_status_updated_at ON public.movie_shots(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_movie_shots_movie_id ON public.movie_shots(movie_id);

-- kling_jobs: code expects columns beyond remote schema (process-kling route)
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS scene_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS result_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS shotstack_render_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS prompt TEXT;

-- omnihuman_jobs: align migration file with production columns
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS kling_task_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS keyframe_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS scene_task_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS scene_video_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS shotstack_render_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS user_id UUID;

-- movies: columns used in app but not in 20260416 migration
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS story_input TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS twin_photo_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS twin_video_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS primary_emotion TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS kling_task_id TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS hook_video_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS template_id TEXT;

-- =============================================================================
-- SECTION D: Functions from migrations (depend on emotion_lines, profiles)
-- =============================================================================
-- Create function to boost emotion lines based on market feedback
CREATE OR REPLACE FUNCTION boost_emotion_lines(archetype TEXT, boost_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE emotion_lines
  SET universality_score = LEAST(10, universality_score + boost_amount)
  WHERE emotion_tags && ARRAY[archetype]::text[];
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION boost_emotion_lines IS 'Boosts universality_score for emotion lines matching the given archetype based on positive market feedback. Score is capped at 10.';

-- Add credits column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Create function to increment user credits atomically
CREATE OR REPLACE FUNCTION increment_user_credits(user_id UUID, credit_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Insert or update profile with credits
  INSERT INTO profiles (id, credits)
  VALUES (user_id, credit_amount)
  ON CONFLICT (id)
  DO UPDATE SET credits = profiles.credits + credit_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);

-- Add comment
COMMENT ON COLUMN profiles.credits IS 'Number of movie credits available to the user';
