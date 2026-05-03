-- Create survey_responses table for post-movie feedback
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  movie_id UUID REFERENCES movies(id),
  email TEXT,
  q1_create TEXT NOT NULL, -- What would you like to create next?
  q2_preference TEXT NOT NULL, -- What did you like most?
  q3_price TEXT NOT NULL, -- Was the price fair?
  q4_voice TEXT NOT NULL, -- How was the voice quality?
  q5_share TEXT NOT NULL, -- Would you share with friends?
  credit_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_movie_id ON survey_responses(movie_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_email ON survey_responses(email);

-- Enable RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous inserts (for survey submission)
CREATE POLICY "Allow insert survey responses"
  ON survey_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow service role to read all
CREATE POLICY "Allow service role to read all survey responses"
  ON survey_responses
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role to update
CREATE POLICY "Allow service role to update survey responses"
  ON survey_responses
  FOR UPDATE
  TO service_role
  USING (true);
