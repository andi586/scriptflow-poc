-- F79 剧本共创引擎 · 数据库Schema

CREATE TABLE IF NOT EXISTS public.script_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    inspiration_input text,
    story_directions jsonb DEFAULT '[]'::jsonb,
    selected_direction text,
    three_act_structure jsonb,
    episode_outlines jsonb DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'ideation'
        CHECK (status IN ('ideation','developing','structuring','writing','confirmed')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS public.script_episodes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    episode_number integer NOT NULL CHECK (episode_number > 0),
    title text,
    full_script_text text,
    modification_history jsonb DEFAULT '[]'::jsonb,
    confirmed boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (project_id, episode_number)
);

CREATE TABLE IF NOT EXISTS public.script_characters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
    script_name text,
    script_description text,
    role_in_story text,
    episodes_appeared integer[] DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (project_id, character_id)
);

-- RLS
ALTER TABLE public.script_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_script_drafts" ON public.script_drafts FOR ALL TO authenticated
    USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "own_script_episodes" ON public.script_episodes FOR ALL TO authenticated
    USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "own_script_characters" ON public.script_characters FOR ALL TO authenticated
    USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

-- 触发器（独立命名避免冲突）
CREATE OR REPLACE FUNCTION public.update_script_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_script_drafts_updated_at
    BEFORE UPDATE ON public.script_drafts
    FOR EACH ROW EXECUTE FUNCTION public.update_script_updated_at();

CREATE TRIGGER trg_script_episodes_updated_at
    BEFORE UPDATE ON public.script_episodes
    FOR EACH ROW EXECUTE FUNCTION public.update_script_updated_at();

CREATE TRIGGER trg_script_characters_updated_at
    BEFORE UPDATE ON public.script_characters
    FOR EACH ROW EXECUTE FUNCTION public.update_script_updated_at();

-- 索引
CREATE INDEX IF NOT EXISTS idx_script_drafts_project ON public.script_drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_script_drafts_status ON public.script_drafts(status);
CREATE INDEX IF NOT EXISTS idx_script_episodes_project ON public.script_episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_script_characters_project ON public.script_characters(project_id);

COMMENT ON TABLE public.script_drafts IS 'F79 剧本共创引擎 - 草稿表';
COMMENT ON TABLE public.script_episodes IS 'F79 剧本共创引擎 - 分集剧本表';
COMMENT ON TABLE public.script_characters IS 'F79 剧本共创引擎 - 剧本角色表';
