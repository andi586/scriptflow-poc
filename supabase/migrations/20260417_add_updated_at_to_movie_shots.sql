-- BUG 8: Add updated_at column to movie_shots for stuck-shot timeout recovery
ALTER TABLE movie_shots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows with created_at value
UPDATE movie_shots SET updated_at = created_at WHERE updated_at IS NULL;

-- Create index for efficient stuck-shot queries
CREATE INDEX IF NOT EXISTS idx_movie_shots_status_updated_at ON movie_shots (status, updated_at);
