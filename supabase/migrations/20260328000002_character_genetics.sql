-- Add genetics column to characters table
-- This column stores character consistency data for AI generation

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS genetics JSONB;

-- Add index for faster genetics queries
CREATE INDEX IF NOT EXISTS idx_characters_genetics 
ON characters USING GIN (genetics);

-- Add comment explaining the genetics structure
COMMENT ON COLUMN characters.genetics IS 
'Character genetics for consistency control. Structure:
{
  "style_vector": {
    "appearance": ["tall", "silver hair", "blue eyes"],
    "costume": ["black armor", "red cape"],
    "personality_markers": ["cold expression", "commanding posture"]
  },
  "prompt_anchors": ["consistent character", "same person"],
  "negative_prompts": ["different face", "costume change"],
  "consistency_score_history": [85, 92, 78]
}';
