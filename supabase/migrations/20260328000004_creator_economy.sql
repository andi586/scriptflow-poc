-- Creator Economy v1.1 - 8 tables
-- Executed in Supabase on 2026-03-28

CREATE TABLE IF NOT EXISTS public.creator_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  asset_data jsonb NOT NULL DEFAULT '{}',
  export_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_creator_assets_creator_id ON public.creator_assets USING btree (creator_id);
ALTER TABLE public.creator_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nel_personal_models (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  style_vectors jsonb NOT NULL DEFAULT '{}',
  training_samples integer DEFAULT 0,
  last_trained_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nel_personal_models_creator_id ON public.nel_personal_models USING btree (creator_id);
ALTER TABLE public.nel_personal_models ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fund_awards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  potential_score decimal(5,4),
  quality_score decimal(5,4),
  novelty_bonus decimal(5,4),
  exposure_inverse decimal(5,4),
  award_period text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fund_awards_creator_id ON public.fund_awards USING btree (creator_id);
ALTER TABLE public.fund_awards ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.star_levels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  star_level integer DEFAULT 1 NOT NULL,
  quality_score_avg decimal(5,4),
  total_earnings decimal(12,2) DEFAULT 0,
  video_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_star_levels_creator_id ON public.star_levels USING btree (creator_id);
ALTER TABLE public.star_levels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.potential_score_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  potential_score decimal(5,4) NOT NULL,
  quality_score decimal(5,4),
  trust_score decimal(5,4),
  exposure_inverse decimal(5,4),
  novelty_bonus decimal(5,4),
  is_cold_start boolean DEFAULT false,
  calculated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_potential_score_logs_creator_id ON public.potential_score_logs USING btree (creator_id);
CREATE INDEX IF NOT EXISTS idx_potential_score_logs_project_id ON public.potential_score_logs USING btree (project_id);
ALTER TABLE public.potential_score_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fund_award_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  award_id uuid NOT NULL REFERENCES public.fund_awards(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_day integer NOT NULL,
  video_count integer DEFAULT 0,
  total_views bigint DEFAULT 0,
  quality_score decimal(5,4),
  recorded_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fund_award_performance_creator_id ON public.fund_award_performance USING btree (creator_id);
CREATE INDEX IF NOT EXISTS idx_fund_award_performance_award_id ON public.fund_award_performance USING btree (award_id);
ALTER TABLE public.fund_award_performance ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.review_committee_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score decimal(5,4) NOT NULL,
  dimension_scores jsonb NOT NULL DEFAULT '{}',
  conflict_of_interest boolean DEFAULT false,
  review_period text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_committee_logs_project_id ON public.review_committee_logs USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_review_committee_logs_reviewer_id ON public.review_committee_logs USING btree (reviewer_id);
ALTER TABLE public.review_committee_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.novelty_manual_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novelty_score decimal(5,4) NOT NULL,
  rationale text,
  is_cold_start_review boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_novelty_manual_scores_project_id ON public.novelty_manual_scores USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_novelty_manual_scores_reviewer_id ON public.novelty_manual_scores USING btree (reviewer_id);
ALTER TABLE public.novelty_manual_scores ENABLE ROW LEVEL SECURITY;
