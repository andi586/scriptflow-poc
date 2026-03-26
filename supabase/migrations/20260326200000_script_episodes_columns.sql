-- F79 分集剧本：补充 script_episodes 字段（与 SQL Editor snippet 对齐）
-- API upsert 写入 status；若仅在 Editor 执行用户 snippet，请追加：
--   ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.script_episodes
ADD COLUMN IF NOT EXISTS total_episodes integer NOT NULL DEFAULT 6,
ADD COLUMN IF NOT EXISTS logline text,
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS scenes jsonb,
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS model text,
ADD COLUMN IF NOT EXISTS rewrite_instruction text,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
