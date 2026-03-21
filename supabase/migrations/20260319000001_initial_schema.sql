-- ScriptFlow · 初始数据库Schema v1.0

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 枚举类型
CREATE TYPE project_status AS ENUM ('draft','analyzing','ready','generating','completed','archived');
CREATE TYPE beat_status AS ENUM ('pending','generating','reviewing','approved','rejected','failed');
CREATE TYPE task_status AS ENUM ('queued','submitted','processing','completed','failed','retrying');
CREATE TYPE generation_provider AS ENUM ('kling','runway','veo','luma','pika');
CREATE TYPE character_role AS ENUM ('protagonist_female','protagonist_male','supporting','background');

-- 表1: projects（痛点#11：aspect_ratio全局锁定）
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  series_title TEXT,
  episode_number INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'en',
  status project_status NOT NULL DEFAULT 'draft',
  script_raw TEXT,
  script_file_url TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  resolution TEXT NOT NULL DEFAULT '1080p',
  default_provider generation_provider NOT NULL DEFAULT 'kling',
  video_duration_sec INTEGER NOT NULL DEFAULT 5,
  total_credits_used DECIMAL(10,4) NOT NULL DEFAULT 0,
  credits_budget DECIMAL(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_aspect_ratio CHECK (aspect_ratio IN ('9:16','16:9','1:1'))
);

-- 表2: story_memory（F01核心：全程故事记忆）
CREATE TABLE story_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  narrative_arc TEXT NOT NULL,
  tone TEXT NOT NULL,
  visual_style TEXT NOT NULL,
  foreshadowing_map JSONB NOT NULL DEFAULT '[]'::jsonb,
  core_visual_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  continuity_notes TEXT NOT NULL,
  raw_analysis JSONB NOT NULL,
  model_used TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_story_per_project UNIQUE (project_id)
);

-- 表3: characters（F10-F12：强制上传，解决痛点#10）
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role character_role NOT NULL,
  appearance TEXT NOT NULL,
  personality TEXT NOT NULL,
  language_fingerprint TEXT NOT NULL,
  reference_image_url TEXT NOT NULL,
  reference_image_path TEXT NOT NULL,
  processed_image_url TEXT,
  appears_in_beats INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_character_per_project UNIQUE (project_id, name)
);

-- 表4: beats（F03叙事翻译输出）
CREATE TABLE beats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  beat_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  emotion TEXT NOT NULL,
  narrative_function TEXT,
  scene_grade CHAR(1),
  prompt TEXT,
  negative_prompt TEXT,
  style_strength DECIMAL(3,2),
  foreshadowing_tag TEXT,
  foreshadowing_symbol TEXT,
  character_ids UUID[] NOT NULL DEFAULT '{}',
  status beat_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  consistency_score DECIMAL(4,2),
  narrative_score DECIMAL(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_beat_per_project UNIQUE (project_id, beat_number),
  CONSTRAINT valid_scene_grade CHECK (scene_grade IN ('A','B','C'))
);

-- 表5: generation_tasks（F15并行调度）
CREATE TABLE generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider generation_provider NOT NULL DEFAULT 'kling',
  provider_task_id TEXT,
  provider_model TEXT,
  status task_status NOT NULL DEFAULT 'queued',
  prompt_snapshot TEXT NOT NULL,
  negative_prompt TEXT,
  estimated_credits DECIMAL(10,4),
  actual_credits DECIMAL(10,4),
  estimated_duration_sec INTEGER,
  actual_duration_sec INTEGER,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 表6: generated_assets（F27按BEAT自动归档）
CREATE TABLE generated_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES generation_tasks(id),
  video_url TEXT NOT NULL,
  video_path TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_sec DECIMAL(5,2),
  consistency_score DECIMAL(4,2),
  narrative_score DECIMAL(4,2),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_beats_project_status ON beats(project_id, status);
CREATE INDEX idx_tasks_status ON generation_tasks(status);
CREATE INDEX idx_tasks_provider_id ON generation_tasks(provider_task_id);
CREATE INDEX idx_assets_beat_id ON generated_assets(beat_id);

-- updated_at 自动触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_characters_updated_at BEFORE UPDATE ON characters
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_beats_updated_at BEFORE UPDATE ON beats
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON generation_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS策略
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_projects" ON projects
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own_story_memory" ON story_memory
FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "own_characters" ON characters
FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "own_beats" ON beats
FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "own_tasks" ON generation_tasks
FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "own_assets" ON generated_assets
FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

