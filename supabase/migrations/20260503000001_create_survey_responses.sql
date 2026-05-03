-- Create survey_responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  question_1 TEXT NOT NULL, -- What kind of story would you like to star in?
  question_2 TEXT NOT NULL, -- What's your dream role?
  question_3 TEXT NOT NULL, -- Pick your movie vibe
  question_4 TEXT NOT NULL, -- How do you want your character to look?
  question_5 TEXT NOT NULL, -- What's your character's superpower?
  question_6 TEXT NOT NULL, -- One word to describe your movie
  free_generation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  token_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_survey_responses_email ON survey_responses(email);

-- Create index on free_generation_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_survey_responses_token ON survey_responses(free_generation_token);

-- Enable RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for survey submission)
CREATE POLICY "Allow anonymous insert survey responses"
  ON survey_responses
  FOR INSERT
  TO anon
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
