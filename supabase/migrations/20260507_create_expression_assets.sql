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
