-- Emotion Video Cache Table
-- Caches Seedance-generated emotion videos to avoid duplicate API calls
-- Saves cost: same photo + same template = reuse cached video

CREATE TABLE IF NOT EXISTS emotion_video_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_url TEXT NOT NULL,
  template_id TEXT NOT NULL,
  emotion TEXT NOT NULL,
  emotion_video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(photo_url, template_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_emotion_cache_lookup 
ON emotion_video_cache(photo_url, template_id);

-- Index for cleanup (delete old cache entries)
CREATE INDEX IF NOT EXISTS idx_emotion_cache_created 
ON emotion_video_cache(created_at);

COMMENT ON TABLE emotion_video_cache IS 'Caches Seedance emotion videos to avoid duplicate API calls and save costs';
COMMENT ON COLUMN emotion_video_cache.photo_url IS 'User photo URL (unique key part 1)';
COMMENT ON COLUMN emotion_video_cache.template_id IS 'Template/archetype ID (unique key part 2)';
COMMENT ON COLUMN emotion_video_cache.emotion IS 'Generated emotion (sad/scared/surprised/neutral)';
COMMENT ON COLUMN emotion_video_cache.emotion_video_url IS 'Seedance-generated video URL';
