-- Add content_watermark column to generated_assets table
-- Migration: 20260328000005_content_watermark
-- Date: 2026-03-28

ALTER TABLE public.generated_assets 
ADD COLUMN IF NOT EXISTS content_watermark text;

COMMENT ON COLUMN public.generated_assets.content_watermark IS 'Base64url-encoded watermark containing creator_id, project_id, episode_id, and cryptographic fingerprint for content provenance tracking';
