-- Migration: Complete generated_assets table schema
-- 20260329000001_generated_assets_complete.sql

CREATE TABLE IF NOT EXISTS public.generated_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.generated_assets
    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
    ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS episode_id uuid,
    ADD COLUMN IF NOT EXISTS asset_type text,
    ADD COLUMN IF NOT EXISTS storage_url text,
    ADD COLUMN IF NOT EXISTS content_watermark text,
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS hts_score decimal(4,2),
    ADD COLUMN IF NOT EXISTS hts_passed boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_generated_assets_creator_id
    ON public.generated_assets (creator_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_project_id
    ON public.generated_assets (project_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_asset_type
    ON public.generated_assets (asset_type);

ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;
