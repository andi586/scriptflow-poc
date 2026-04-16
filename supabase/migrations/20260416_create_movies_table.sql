CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY,
  user_id UUID,
  status TEXT DEFAULT 'pending',
  total_shots INTEGER,
  completed_shots INTEGER DEFAULT 0,
  final_video_url TEXT,
  shotstack_render_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
