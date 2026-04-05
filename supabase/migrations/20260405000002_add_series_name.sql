-- Migration: Add series_name to projects table
-- Director Mode users can set a custom series name (e.g. "My Family Drama")
-- Star Mode and default Director Mode leave this null (no title card shown)

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS series_name text;

COMMENT ON COLUMN projects.series_name IS
  'User-defined series name for Director Mode (e.g. "My Family Drama"). Null = no series branding on title card.';
