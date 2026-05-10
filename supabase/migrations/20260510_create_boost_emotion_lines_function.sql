-- Create function to boost emotion lines based on market feedback
CREATE OR REPLACE FUNCTION boost_emotion_lines(archetype TEXT, boost_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE emotion_lines
  SET universality_score = LEAST(10, universality_score + boost_amount)
  WHERE emotion_tags && ARRAY[archetype]::text[];
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION boost_emotion_lines IS 'Boosts universality_score for emotion lines matching the given archetype based on positive market feedback. Score is capped at 10.';
