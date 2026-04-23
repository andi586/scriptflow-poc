-- Add hook video and template columns to movies table
ALTER TABLE movies ADD COLUMN IF NOT EXISTS hook_video_url TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS template_id TEXT;
