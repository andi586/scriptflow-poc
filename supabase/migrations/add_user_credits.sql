-- Add credits column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Create function to increment user credits atomically
CREATE OR REPLACE FUNCTION increment_user_credits(user_id UUID, credit_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Insert or update profile with credits
  INSERT INTO profiles (id, credits)
  VALUES (user_id, credit_amount)
  ON CONFLICT (id)
  DO UPDATE SET credits = profiles.credits + credit_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON profiles(credits);

-- Add comment
COMMENT ON COLUMN profiles.credits IS 'Number of movie credits available to the user';
