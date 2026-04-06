-- Migration: Add user_voice_id to projects table
-- Stores the ElevenLabs cloned voice ID from user's recording.
-- Used by finalize pipeline to prefer user's own voice for TTS.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS user_voice_id text;

COMMENT ON COLUMN projects.user_voice_id IS
  'ElevenLabs cloned voice ID generated from user recording. When set, finalize pipeline uses this voice for all TTS instead of default Caius/Luna.';
