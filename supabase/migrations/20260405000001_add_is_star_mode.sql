-- Migration: Add is_star_mode flag to projects table
-- Be the Star mode projects skip episode title cards in the finalize pipeline

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_star_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN projects.is_star_mode IS
  'When true, the finalize pipeline skips intro/end episode title cards (Wolf Emperor series branding). Used by Be the Star mode.';
