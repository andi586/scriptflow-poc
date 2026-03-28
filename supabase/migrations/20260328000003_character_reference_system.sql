-- supabase/migrations/20260328000003_character_reference_system.sql
-- Pain Point #1 根治方案：角色一致性参考图系统

-- 角色参考图资产表（每角色4张：正面、左45°、右45°、半身）
CREATE TABLE IF NOT EXISTS public.character_reference_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL CHECK (image_type IN ('front', 'left_45', 'right_45', 'half_body')),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 角色跨镜头连续性状态表（O(1)查最近成功视频用于video relay）
CREATE TABLE IF NOT EXISTS public.character_continuity_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  episode_id UUID NOT NULL,
  character_id UUID NOT NULL,
  latest_successful_video_url TEXT,
  latest_successful_task_id TEXT,
  latest_scene_index INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (episode_id, character_id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_char_ref_assets_character_id
  ON public.character_reference_assets (character_id);

CREATE INDEX IF NOT EXISTS idx_char_ref_assets_project_id
  ON public.character_reference_assets (project_id);

CREATE INDEX IF NOT EXISTS idx_char_continuity_episode_character
  ON public.character_continuity_state (episode_id, character_id);

CREATE INDEX IF NOT EXISTS idx_char_continuity_project_id
  ON public.character_continuity_state (project_id);

-- RLS 策略
ALTER TABLE public.character_reference_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_continuity_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户管理自己的角色参考图"
  ON public.character_reference_assets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户管理自己的角色连续性状态"
  ON public.character_continuity_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 注释
COMMENT ON TABLE public.character_reference_assets IS '角色多角度参考图资产表 - 每角色4张标准视角';
COMMENT ON TABLE public.character_continuity_state IS '角色跨镜头连续性状态 - 存储最近成功视频用于video relay';
COMMENT ON COLUMN public.character_reference_assets.image_type IS '图片类型：front(正面), left_45(左45度), right_45(右45度), half_body(半身)';
COMMENT ON COLUMN public.character_continuity_state.latest_successful_video_url IS '最近一次成功生成的视频URL，用作下一镜头的video relay输入';
