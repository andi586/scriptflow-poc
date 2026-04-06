<!DOCTYPE html>

<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ScriptFlow PoC · 完整开发文档</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@300;400;500;600&display=swap');

- { margin: 0; padding: 0; box-sizing: border-box; }

body {
font-family: ‘Inter’, sans-serif;
background: #0a0a0f;
color: #e2e8f0;
line-height: 1.7;
}

.header {
background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
border-bottom: 1px solid #f59e0b33;
padding: 48px 40px;
position: relative;
overflow: hidden;
}

.header::before {
content: ‘’;
position: absolute;
top: -50%;
right: -10%;
width: 400px;
height: 400px;
background: radial-gradient(circle, #f59e0b15 0%, transparent 70%);
pointer-events: none;
}

.header-badge {
display: inline-block;
background: #f59e0b22;
border: 1px solid #f59e0b55;
color: #f59e0b;
font-family: ‘JetBrains Mono’, monospace;
font-size: 11px;
padding: 4px 12px;
border-radius: 4px;
letter-spacing: 2px;
margin-bottom: 16px;
}

.header h1 {
font-size: 36px;
font-weight: 600;
color: #fff;
margin-bottom: 8px;
}

.header h1 span { color: #f59e0b; }

.header-meta {
font-size: 13px;
color: #64748b;
font-family: ‘JetBrains Mono’, monospace;
}

.header-insight {
margin-top: 20px;
padding: 16px 20px;
background: #f59e0b11;
border-left: 3px solid #f59e0b;
border-radius: 0 8px 8px 0;
font-size: 14px;
color: #cbd5e1;
font-style: italic;
max-width: 700px;
}

.tech-stack {
display: flex;
flex-wrap: wrap;
gap: 8px;
margin-top: 20px;
}

.tech-tag {
background: #1e293b;
border: 1px solid #334155;
color: #94a3b8;
font-family: ‘JetBrains Mono’, monospace;
font-size: 11px;
padding: 4px 10px;
border-radius: 4px;
}

.container {
max-width: 900px;
margin: 0 auto;
padding: 40px;
}

.step {
margin-bottom: 60px;
}

.step-header {
display: flex;
align-items: center;
gap: 16px;
margin-bottom: 24px;
padding-bottom: 16px;
border-bottom: 1px solid #1e293b;
}

.step-number {
background: #f59e0b;
color: #000;
font-family: ‘JetBrains Mono’, monospace;
font-weight: 600;
font-size: 12px;
width: 40px;
height: 40px;
border-radius: 8px;
display: flex;
align-items: center;
justify-content: center;
flex-shrink: 0;
}

.step-title {
font-size: 22px;
font-weight: 600;
color: #f1f5f9;
}

.step-subtitle {
font-size: 13px;
color: #64748b;
margin-top: 2px;
font-family: ‘JetBrains Mono’, monospace;
}

h3 {
font-size: 15px;
font-weight: 600;
color: #f59e0b;
margin: 24px 0 12px;
text-transform: uppercase;
letter-spacing: 1px;
}

p { color: #94a3b8; font-size: 14px; margin-bottom: 12px; }

.warning {
background: #ef444411;
border: 1px solid #ef444433;
border-left: 3px solid #ef4444;
padding: 12px 16px;
border-radius: 0 8px 8px 0;
margin: 12px 0;
font-size: 13px;
color: #fca5a5;
}

.warning strong { color: #ef4444; }

code {
font-family: ‘JetBrains Mono’, monospace;
background: #1e293b;
color: #f59e0b;
padding: 2px 6px;
border-radius: 4px;
font-size: 12px;
}

pre {
background: #0f172a;
border: 1px solid #1e293b;
border-radius: 8px;
padding: 20px;
overflow-x: auto;
margin: 16px 0;
position: relative;
}

pre code {
background: none;
color: #e2e8f0;
padding: 0;
font-size: 12px;
line-height: 1.6;
}

.file-label {
font-family: ‘JetBrains Mono’, monospace;
font-size: 11px;
color: #64748b;
background: #1e293b;
display: inline-block;
padding: 4px 10px;
border-radius: 4px 4px 0 0;
margin-bottom: -1px;
border: 1px solid #334155;
}

table {
width: 100%;
border-collapse: collapse;
margin: 16px 0;
font-size: 13px;
}

th {
background: #1e293b;
color: #94a3b8;
padding: 10px 14px;
text-align: left;
font-weight: 500;
border: 1px solid #334155;
}

td {
padding: 10px 14px;
border: 1px solid #1e293b;
color: #cbd5e1;
vertical-align: top;
}

tr:hover td { background: #0f172a; }

.highlight { color: #f59e0b; }

.cmd-block {
background: #000;
border: 1px solid #334155;
border-radius: 8px;
padding: 16px 20px;
margin: 12px 0;
font-family: ‘JetBrains Mono’, monospace;
font-size: 12px;
color: #4ade80;
line-height: 1.8;
}

.cmd-block .comment { color: #475569; }

.section-divider {
border: none;
border-top: 1px solid #1e293b;
margin: 40px 0;
}

.milestone {
background: linear-gradient(135deg, #f59e0b11, #f59e0b05);
border: 1px solid #f59e0b33;
border-radius: 12px;
padding: 20px 24px;
margin: 24px 0;
}

.milestone-title {
font-weight: 600;
color: #f59e0b;
font-size: 14px;
margin-bottom: 8px;
}

.milestone p { margin: 0; font-size: 13px; }
</style>

</head>
<body>

<div class="header">
  <div class="header-badge">SCRIPTFLOW · POC DEVELOPMENT GUIDE</div>
  <h1>ScriptFlow <span>开发全册</span></h1>
  <div class="header-meta">版本：PoC v1.0 · 2026.03.15 · Jiming + Claude</div>
  <div class="header-insight">
    「没有一个系统在全程理解这个故事，才导致的割裂感。」<br>
    目标：6–8周一人跑通，验证叙事引擎是否真正解决短剧割裂感<br>
    核心验证：F01 + F03 + F10–F12 + F15 + F20 + F27
  </div>
  <div class="tech-stack">
    <span class="tech-tag">Next.js 15</span>
    <span class="tech-tag">TypeScript Strict</span>
    <span class="tech-tag">Supabase</span>
    <span class="tech-tag">Anthropic SDK</span>
    <span class="tech-tag">Kling API (PiAPI)</span>
    <span class="tech-tag">shadcn/ui</span>
    <span class="tech-tag">Vercel</span>
    <span class="tech-tag">next-intl</span>
    <span class="tech-tag">Zod</span>
  </div>
</div>

<div class="container">

<!-- STEP 1 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">01</div>
    <div>
      <div class="step-title">整体项目架构与文件夹结构</div>
      <div class="step-subtitle">Next.js 15 App Router · 8层清晰分离 · 支持V1.1无痛扩展</div>
    </div>
  </div>

  <h3>架构决策</h3>
  <p><strong class="highlight">决策①</strong>：用 Anthropic SDK 直接调用替代 LangChain.js。LangChain抽象层过重，单人维护debug成本极高。</p>
  <p><strong class="highlight">决策②</strong>：Supabase Edge Function 有60秒执行限制，Kling生成需5–15分钟会超时。改用 <code>Vercel Cron Jobs + 轮询状态</code>：提交→返回task_id→每30秒轮询→完成推送。</p>
  <p><strong class="highlight">国际化</strong>：界面使用 next-intl，英文为主，支持 en/zh 切换。</p>

  <h3>初始化命令（按顺序执行）</h3>
  <div class="cmd-block">
    <span class="comment"># 1. 创建项目（已完成）</span><br>
    npx create-next-app@latest scriptflow-poc \<br>
    &nbsp;&nbsp;--typescript --tailwind --eslint --app \<br>
    &nbsp;&nbsp;--src-dir=false --import-alias="@/*"<br>
    cd scriptflow-poc<br><br>
    <span class="comment"># 2. 安装核心依赖（已完成）</span><br>
    npm install @supabase/supabase-js @supabase/ssr<br>
    npm install @anthropic-ai/sdk<br>
    npm install zod clsx tailwind-merge lucide-react<br>
    npm install react-dropzone date-fns next-intl<br><br>
    <span class="comment"># 3. 安装shadcn/ui（已完成）</span><br>
    npx shadcn@latest init<br>
    npx shadcn@latest add button card dialog input label progress badge toast skeleton separator<br><br>
    <span class="comment"># 4. 验证</span><br>
    npm run dev <span class="comment"># 应该在 localhost:3000 正常启动</span>
  </div>

  <h3>完整目录结构</h3>
  <pre><code>scriptflow-poc/
├── app/                          # Next.js App Router 页面层
│   ├── [locale]/                 # next-intl 国际化路由
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── new-project/page.tsx
│   │   │   └── project/[id]/page.tsx  # 主生成页面
│   └── api/kling/callback/route.ts
├── components/
│   ├── ui/                       # shadcn/ui
│   ├── project/
│   │   ├── BeatGrid.tsx
│   │   ├── GenerationProgress.tsx
│   │   └── ConsistencyScore.tsx
│   ├── narrative/
│   │   └── StoryMemoryViewer.tsx
│   └── shared/
│       ├── CostPreview.tsx       # 生成前必显示成本预估
│       └── UploadZone.tsx
├── lib/                          # 核心业务逻辑
│   ├── narrative-engine/         # NEL叙事引擎（F01+F03）
│   │   ├── parser.ts             # 剧本→故事记忆库JSON
│   │   ├── translator.ts         # 故事记忆→提示词序列
│   │   └── judge.ts              # 一致性评分
│   ├── character-manager/
│   │   └── injector.ts
│   ├── generation/               # F15 可插拔Provider
│   │   ├── provider.ts           # 抽象接口
│   │   ├── kling-provider.ts
│   │   └── cost-estimator.ts
│   ├── quality-check/index.ts    # F20
│   ├── storage/index.ts          # F27
│   └── supabase/
│       ├── client.ts             # 浏览器端
│       └── server.ts             # 服务端（Service Role）
├── actions/                      # Server Actions
│   ├── project.actions.ts
│   ├── narrative.actions.ts
│   ├── character.actions.ts
│   └── generation.actions.ts
├── prompts/                      # 所有System Prompt集中管理
│   ├── nel-sentinel.ts
│   ├── narrative-translator.ts
│   └── consistency-judge.ts
├── types/index.ts                # 全部TypeScript类型
├── messages/                     # i18n语言包
│   ├── en.json
│   └── zh.json
├── supabase/migrations/          # SQL migration文件
├── .env.local                    # 已配置
├── middleware.ts
├── next.config.ts
└── tsconfig.json</code></pre>

  <div class="warning">
    <strong>风险①</strong> Node.js 必须 ≥ 18.17（已确认 v24 ✅）<br>
    <strong>风险②</strong> Supabase 创建时选 Southeast Asia (Singapore)（已完成 ✅）<br>
    <strong>风险③</strong> 目录结构确定后不要中途改动，Server Actions路径依赖目录
  </div>
</div>

<hr class="section-divider">

<!-- STEP 2 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">02</div>
    <div>
      <div class="step-title">Supabase 数据库 Schema</div>
      <div class="step-subtitle">6张表 · 完整SQL Migration · RLS安全策略 · 痛点直接映射</div>
    </div>
  </div>

  <h3>表总览</h3>
  <table>
    <tr><th>表名</th><th>职责</th><th>对应功能</th><th>解决痛点</th></tr>
    <tr><td>projects</td><td>项目主表</td><td>项目管理</td><td>#11 比例全局锁定</td></tr>
    <tr><td>story_memory</td><td>NEL叙事引擎解析结果</td><td>F01</td><td>跨集叙事失忆</td></tr>
    <tr><td>characters</td><td>角色档案</td><td>F10-F12</td><td>#10 强制参考图</td></tr>
    <tr><td>beats</td><td>BEAT列表+提示词</td><td>F03</td><td>叙事割裂</td></tr>
    <tr><td>generation_tasks</td><td>并行任务队列</td><td>F15</td><td>#18 成本熔断</td></tr>
    <tr><td>generated_assets</td><td>素材归档</td><td>F27</td><td>#06 自动归档</td></tr>
  </table>

  <h3>完整 SQL Migration</h3>
  <div class="file-label">supabase/migrations/20260319000001_initial_schema.sql</div>
  <pre><code>-- ScriptFlow PoC · 初始数据库Schema v1.0

CREATE EXTENSION IF NOT EXISTS “uuid-ossp”;

– 枚举类型
CREATE TYPE project_status AS ENUM (‘draft’,‘analyzing’,‘ready’,‘generating’,‘completed’,‘archived’);
CREATE TYPE beat_status AS ENUM (‘pending’,‘generating’,‘reviewing’,‘approved’,‘rejected’,‘failed’);
CREATE TYPE task_status AS ENUM (‘queued’,‘submitted’,‘processing’,‘completed’,‘failed’,‘retrying’);
CREATE TYPE generation_provider AS ENUM (‘kling’,‘runway’,‘veo’,‘luma’,‘pika’);
CREATE TYPE character_role AS ENUM (‘protagonist_female’,‘protagonist_male’,‘supporting’,‘background’);

– 表1: projects（痛点#11：aspect_ratio全局锁定）
CREATE TABLE projects (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
title TEXT NOT NULL,
series_title TEXT,
episode_number INTEGER NOT NULL DEFAULT 1,
language TEXT NOT NULL DEFAULT ‘en’,
status project_status NOT NULL DEFAULT ‘draft’,
script_raw TEXT,
script_file_url TEXT,
aspect_ratio TEXT NOT NULL DEFAULT ‘9:16’,
resolution TEXT NOT NULL DEFAULT ‘1080p’,
default_provider generation_provider NOT NULL DEFAULT ‘kling’,
video_duration_sec INTEGER NOT NULL DEFAULT 5,
total_credits_used DECIMAL(10,4) NOT NULL DEFAULT 0,
credits_budget DECIMAL(10,4),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT valid_aspect_ratio CHECK (aspect_ratio IN (‘9:16’,‘16:9’,‘1:1’))
);

– 表2: story_memory（F01核心：全程故事记忆）
CREATE TABLE story_memory (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
narrative_arc TEXT NOT NULL,
tone TEXT NOT NULL,
visual_style TEXT NOT NULL,
foreshadowing_map JSONB NOT NULL DEFAULT ‘[]’,
core_visual_symbols JSONB NOT NULL DEFAULT ‘[]’,
continuity_notes TEXT NOT NULL,
raw_analysis JSONB NOT NULL,
model_used TEXT NOT NULL DEFAULT ‘claude-sonnet-4-20250514’,
parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT unique_story_per_project UNIQUE (project_id)
);

– 表3: characters（F10-F12：强制上传，解决痛点#10）
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
appears_in_beats INTEGER[] NOT NULL DEFAULT ‘{}’,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT unique_character_per_project UNIQUE (project_id, name)
);

– 表4: beats（F03叙事翻译输出）
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
character_ids UUID[] NOT NULL DEFAULT ‘{}’,
status beat_status NOT NULL DEFAULT ‘pending’,
retry_count INTEGER NOT NULL DEFAULT 0,
max_retries INTEGER NOT NULL DEFAULT 2,
consistency_score DECIMAL(4,2),
narrative_score DECIMAL(4,2),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT unique_beat_per_project UNIQUE (project_id, beat_number),
CONSTRAINT valid_scene_grade CHECK (scene_grade IN (‘A’,‘B’,‘C’))
);

– 表5: generation_tasks（F15并行调度）
CREATE TABLE generation_tasks (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
provider generation_provider NOT NULL DEFAULT ‘kling’,
provider_task_id TEXT,
provider_model TEXT,
status task_status NOT NULL DEFAULT ‘queued’,
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

– 表6: generated_assets（F27按BEAT自动归档）
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

– 索引
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_beats_project_status ON beats(project_id, status);
CREATE INDEX idx_tasks_status ON generation_tasks(status);
CREATE INDEX idx_tasks_provider_id ON generation_tasks(provider_task_id);
CREATE INDEX idx_assets_beat_id ON generated_assets(beat_id);

– updated_at 自动触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_beats_updated_at BEFORE UPDATE ON beats FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON generation_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

– RLS策略
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY “own_projects” ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY “own_story_memory” ON story_memory FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY “own_characters” ON characters FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY “own_beats” ON beats FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY “own_tasks” ON generation_tasks FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY “own_assets” ON generated_assets FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));</code></pre>

  <div class="warning">
    <strong>风险①</strong> RLS启用后Server Actions必须用Service Role Key，搞混会导致写操作静默失败<br>
    <strong>风险②</strong> Storage Bucket须在Dashboard手动创建：scriptflow-scripts、scriptflow-characters、scriptflow-assets（全部Private）
  </div>
</div>

<hr class="section-divider">

<!-- STEP 3 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">03</div>
    <div>
      <div class="step-title">核心 TypeScript 类型定义</div>
      <div class="step-subtitle">types/index.ts · Strict模式 · Zod校验 · 数据库Schema完全映射</div>
    </div>
  </div>

  <div class="file-label">types/index.ts</div>
  <pre><code>export type ProjectStatus = 'draft' | 'analyzing' | 'ready' | 'generating' | 'completed' | 'archived'
export type BeatStatus = 'pending' | 'generating' | 'reviewing' | 'approved' | 'rejected' | 'failed'
export type TaskStatus = 'queued' | 'submitted' | 'processing' | 'completed' | 'failed' | 'retrying'
export type GenerationProvider = 'kling' | 'runway' | 'veo' | 'luma' | 'pika'
export type CharacterRole = 'protagonist_female' | 'protagonist_male' | 'supporting' | 'background'
export type SceneGrade = 'A' | 'B' | 'C'
export type AspectRatio = '9:16' | '16:9' | '1:1'

export interface Project {
id: string
user_id: string
title: string
aspect_ratio: AspectRatio
resolution: string
default_provider: GenerationProvider
video_duration_sec: number
total_credits_used: number
credits_budget: number | null
script_raw: string | null
status: ProjectStatus
created_at: string
updated_at: string
}

export interface StoryMemory {
id: string
project_id: string
narrative_arc: string
tone: string
visual_style: string
foreshadowing_map: ForeshadowingItem[]
core_visual_symbols: string[]
continuity_notes: string
raw_analysis: Record<string, unknown>
model_used: string
parsed_at: string
}

export interface ForeshadowingItem {
symbol: string
planted_at_beat: number
reinforced_at_beats: number[]
resolved_at_beat: number
significance: string
}

export interface Character {
id: string
project_id: string
name: string
role: CharacterRole
appearance: string
personality: string
language_fingerprint: string
reference_image_url: string
reference_image_path: string
processed_image_url: string | null
appears_in_beats: number[]
created_at: string
updated_at: string
}

export interface Beat {
id: string
project_id: string
beat_number: number
description: string
emotion: string
scene_grade: SceneGrade | null
prompt: string | null
negative_prompt: string | null
character_ids: string[]
status: BeatStatus
consistency_score: number | null
narrative_score: number | null
created_at: string
updated_at: string
}

export interface GenerationRequest {
prompt: string
negative_prompt?: string
duration_sec: number
aspect_ratio: AspectRatio
resolution: string
reference_images?: string[]
style_strength?: number
}

export interface CostEstimate {
credits: number
usd: number
breakdown: string
}

export interface ConsistencyJudgment {
consistency_score: number
narrative_score: number
passed: boolean
reasoning: string
issues: string[]
}

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string }</code></pre>

</div>

<hr class="section-divider">

<!-- STEP 4 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">04</div>
    <div>
      <div class="step-title">叙事理解引擎（NEL Sentinel）</div>
      <div class="step-subtitle">F01 + F03 · ScriptFlow的护城河 · Anthropic SDK直接调用</div>
    </div>
  </div>

  <div class="file-label">prompts/nel-sentinel.ts</div>
  <pre><code>export const NEL_SENTINEL_PROMPT = `你是一个专业短剧叙事架构师。你已完整阅读整个剧本，必须全程维持故事记忆。

任务：分析短剧剧本，输出完整的故事记忆库JSON。

必须严格遵守：

- 识别所有角色的外形、性格、语言指纹（语气风格）
- 拆解叙事弧（开端/冲突/高潮/转折）
- 为每个BEAT标注情绪、叙事功能、伏笔关系
- 追踪所有伏笔的埋下→强化→闭合完整链路
- 识别核心视觉符号（将用于质检校验）
- 输出跨集保持一致的关键要素清单

只输出JSON，不要任何多余文字、不要代码块标记。`

export const NARRATIVE_TRANSLATOR_PROMPT = `你是一个专业短剧提示词工程师。你已完整阅读整个剧本和故事记忆库。

任务：为每个BEAT生成Kling AI最优生成提示词。

必须严格遵守：

- 保持与第1集第1场的叙事基调、视觉风格完全一致
- 角色外形描述必须锁定（不能有任何偏差）
- 伏笔在指定位置必须出现
- 禁止使用任何剪辑语言（Cut to / Then / Next / After）
- 提示词必须是单镜头纯视觉描述
- 场景分级：A级直接生成，B级标注需拆分，C级给出替代方案
- 输出格式为JSON数组

只输出JSON，不要任何多余文字。`</code></pre>

  <div class="file-label">lib/narrative-engine/parser.ts</div>
  <pre><code>import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { NEL_SENTINEL_PROMPT } from '@/prompts/nel-sentinel'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const NarrativeAnalysisSchema = z.object({
series_title: z.string(),
episode: z.number(),
episode_title: z.string(),
narrative_arc: z.string().min(10),
tone: z.string().min(5),
visual_style: z.string().min(5),
characters: z.array(z.object({
name: z.string(),
role: z.enum([‘protagonist_female’,‘protagonist_male’,‘supporting’,‘background’]),
appearance: z.string(),
personality: z.string(),
language_fingerprint: z.string(),
})).min(1),
beats: z.array(z.object({
beat_number: z.number(),
description: z.string(),
emotion: z.string(),
narrative_function: z.string(),
foreshadowing: z.string().nullable(),
})).min(1),
foreshadowing_map: z.array(z.object({
symbol: z.string(),
planted_at_beat: z.number(),
reinforced_at_beats: z.array(z.number()),
resolved_at_beat: z.number(),
significance: z.string(),
})),
core_visual_symbols: z.array(z.string()),
cross_episode_continuity_notes: z.string(),
})

export type NarrativeAnalysis = z.infer<typeof NarrativeAnalysisSchema>

export async function parseScript(scriptText: string): Promise<NarrativeAnalysis> {
if (!scriptText || scriptText.trim().length < 50) {
throw new Error(‘剧本内容太短，无法解析’)
}

const message = await client.messages.create({
model: ‘claude-sonnet-4-20250514’,
max_tokens: 4096,
system: NEL_SENTINEL_PROMPT,
messages: [{
role: ‘user’,
content: `请分析以下短剧剧本：\n\n${scriptText}\n\n输出完整的故事记忆库JSON。`
}]
})

const textContent = message.content.find(c => c.type === ‘text’)
if (!textContent || textContent.type !== ‘text’) {
throw new Error(‘Claude未返回文本内容’)
}

let jsonText = textContent.text.trim()
if (jsonText.startsWith(’`')) { jsonText = jsonText.replace(/`json?\n?/, ‘’).replace(/```$/, ‘’).trim()
}

let parsed: unknown
try {
parsed = JSON.parse(jsonText)
} catch {
throw new Error(`JSON解析失败：${jsonText.substring(0, 200)}`)
}

const result = NarrativeAnalysisSchema.safeParse(parsed)
if (!result.success) {
throw new Error(`叙事分析结构不完整：${result.error.message}`)
}

return result.data
}</code></pre>

  <div class="warning">
    <strong>风险①</strong> Claude有时会在JSON前后加```代码块标记，parser里已处理<br>
    <strong>风险②</strong> max_tokens设置：parser用4096，translator用8192（10个BEAT的提示词很长）
  </div>
</div>

<hr class="section-divider">

<!-- STEP 5 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">05</div>
    <div>
      <div class="step-title">角色管理系统</div>
      <div class="step-subtitle">F10-F12 · 强制上传 · 自动注入 · 解决痛点#10</div>
    </div>
  </div>

  <div class="file-label">lib/character-manager/injector.ts</div>
  <pre><code>import type { Beat, Character, GenerationRequest } from '@/types'

export function getBeatsCharacters(beat: Beat, allCharacters: Character[]): Character[] {
return allCharacters.filter(c => beat.character_ids.includes(c.id))
}

export function injectCharacters(request: GenerationRequest, characters: Character[]): GenerationRequest {
if (characters.length === 0) return request

const sorted = […characters].sort((a, b) => {
const order = { protagonist_female: 0, protagonist_male: 1, supporting: 2, background: 3 }
return (order[a.role] ?? 4) - (order[b.role] ?? 4)
})

// 警告：超过1张参考图会禁用9:16比例（痛点#19/#20）
const protagonists = sorted.filter(c =>
c.role === ‘protagonist_female’ || c.role === ‘protagonist_male’
)
const safeReferenceImages = protagonists
.map(c => c.processed_image_url ?? c.reference_image_url)
.filter(Boolean)
.slice(0, 1) as string[]  // 只传1张！

const appearancePrefix = sorted.map(c => c.appearance).join(’ ’)

return {
…request,
prompt: `${appearancePrefix}. ${request.prompt}`,
reference_images: safeReferenceImages.length > 0 ? safeReferenceImages : undefined
}
}

export function validateCharacterReadiness(characters: Character[]): {
ready: boolean
missing: string[]
} {
const protagonists = characters.filter(c =>
c.role === ‘protagonist_female’ || c.role === ‘protagonist_male’
)
if (protagonists.length === 0) {
return { ready: false, missing: [‘至少需要一个主角’] }
}
const missing = protagonists
.filter(c => !c.reference_image_url)
.map(c => `${c.name} 缺少参考图`)
return { ready: missing.length === 0, missing }
}</code></pre>

</div>

<hr class="section-divider">

<!-- STEP 6 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">06</div>
    <div>
      <div class="step-title">生成服务（可插拔 Provider）</div>
      <div class="step-subtitle">F15 并行调度 · Provider抽象接口 · 成本预估</div>
    </div>
  </div>

  <div class="file-label">lib/generation/provider.ts（抽象接口）</div>
  <pre><code>import type { GenerationRequest, GenerationResult, CostEstimate, TaskStatus } from '@/types'

export interface IGenerationProvider {
name: string
submitTask(request: GenerationRequest): Promise<GenerationResult>
checkStatus(taskId: string): Promise<{ status: TaskStatus; video_url?: string; error?: string }>
estimateCost(request: GenerationRequest): CostEstimate
}

const PROVIDERS = new Map<string, IGenerationProvider>()

export function registerProvider(provider: IGenerationProvider): void {
PROVIDERS.set(provider.name, provider)
}

export function getProvider(name: string): IGenerationProvider {
const provider = PROVIDERS.get(name)
if (!provider) throw new Error(`Provider "${name}" 未注册`)
return provider
}</code></pre>

  <div class="file-label">lib/generation/kling-provider.ts</div>
  <pre><code>import type { IGenerationProvider } from './provider'
import type { GenerationRequest, GenerationResult, CostEstimate, TaskStatus } from '@/types'
import { registerProvider } from './provider'

const KLING_API_BASE = process.env.KLING_API_BASE ?? ‘https://api.piapi.ai/api/v1’
const KLING_API_KEY = process.env.KLING_API_KEY ?? ‘’
const CREDITS_PER_SECOND = 0.14
const USD_PER_CREDIT = 0.0014

export const KlingProvider: IGenerationProvider = {
name: ‘kling’,

async submitTask(request): Promise<GenerationResult> {
const payload = {
model: ‘kling-v3-omni’,
prompt: request.prompt,
negative_prompt: request.negative_prompt,
aspect_ratio: request.aspect_ratio,
duration: request.duration_sec,
cfg_scale: request.style_strength ?? 0.5,
…(request.reference_images?.[0] && { image_url: request.reference_images[0] })
}

```
const res = await fetch(`${KLING_API_BASE}/video/generation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': KLING_API_KEY },
  body: JSON.stringify(payload),
})

if (!res.ok) throw new Error(`Kling API错误 ${res.status}: ${await res.text()}`)
const data = await res.json()
return { provider_task_id: data.task_id, status: 'submitted', estimated_duration_sec: data.estimated_time }
```

},

async checkStatus(taskId) {
const res = await fetch(`${KLING_API_BASE}/video/generation/${taskId}`, {
headers: { ‘X-API-Key’: KLING_API_KEY }
})
if (!res.ok) return { status: ‘failed’ as TaskStatus, error: ‘状态查询失败’ }
const data = await res.json()
const statusMap: Record<string, TaskStatus> = {
‘pending’: ‘processing’, ‘running’: ‘processing’,
‘success’: ‘completed’, ‘failed’: ‘failed’,
}
return { status: statusMap[data.status] ?? ‘processing’, video_url: data.works?.[0]?.video?.url }
},

estimateCost(request): CostEstimate {
const credits = request.duration_sec * CREDITS_PER_SECOND
return { credits, usd: credits * USD_PER_CREDIT, breakdown: `${request.duration_sec}s × ${CREDITS_PER_SECOND} = ${credits.toFixed(2)} credits` }
}
}

registerProvider(KlingProvider)</code></pre>

</div>

<hr class="section-divider">

<!-- STEP 7 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">07</div>
    <div>
      <div class="step-title">页面与 UI</div>
      <div class="step-subtitle">5个页面 · shadcn/ui · 英文界面 · 操作步数≤3步</div>
    </div>
  </div>

  <h3>页面清单</h3>
  <table>
    <tr><th>路由</th><th>页面</th><th>核心功能</th></tr>
    <tr><td>/login</td><td>登录页</td><td>Supabase Auth邮箱登录</td></tr>
    <tr><td>/dashboard</td><td>项目列表</td><td>所有项目+进度+新建入口</td></tr>
    <tr><td>/new-project</td><td>新建项目</td><td>上传剧本→解析→上传角色→确认</td></tr>
    <tr><td>/project/[id]</td><td>主生成页</td><td>BEAT网格+一键生成+实时进度+素材库</td></tr>
    <tr><td>/project/[id]/story</td><td>故事记忆页</td><td>查看NEL解析结果+伏笔地图</td></tr>
  </table>

  <div class="file-label">components/shared/CostPreview.tsx（生成前必显示）</div>
  <pre><code>'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CostEstimate } from '@/types'

interface CostPreviewProps {
estimates: CostEstimate[]
beatCount: number
onConfirm: () => void
onCancel: () => void
open: boolean
}

export function CostPreview({ estimates, beatCount, onConfirm, onCancel, open }: CostPreviewProps) {
const totalCredits = estimates.reduce((sum, e) => sum + e.credits, 0)
const totalUsd = estimates.reduce((sum, e) => sum + e.usd, 0)

return (
<Dialog open={open} onOpenChange={open => !open && onCancel()}>
<DialogContent>
<DialogHeader>
<DialogTitle>Generation Cost Preview</DialogTitle>
</DialogHeader>
<div className=“grid grid-cols-3 gap-4 text-center py-4”>
<div><p className=“text-2xl font-bold”>{beatCount}</p><p className=“text-xs”>Beats</p></div>
<div><p className=“text-2xl font-bold”>{totalCredits.toFixed(1)}</p><p className=“text-xs”>Credits</p></div>
<div><p className=“text-2xl font-bold”>${totalUsd.toFixed(2)}</p><p className=“text-xs”>USD</p></div>
</div>
<DialogFooter>
<Button variant=“outline” onClick={onCancel}>Cancel</Button>
<Button onClick={onConfirm}>Confirm & Generate</Button>
</DialogFooter>
</DialogContent>
</Dialog>
)
}</code></pre>

</div>

<hr class="section-divider">

<!-- STEP 8 -->

<div class="step">
  <div class="step-header">
    <div class="step-number">08</div>
    <div>
      <div class="step-title">环境变量、部署配置与完整启动命令</div>
      <div class="step-subtitle">Vercel一键部署 · 环境变量模板 · 完整测试流程</div>
    </div>
  </div>

  <h3>.env.local 模板（已配置完成 ✅）</h3>
  <pre><code>NEXT_PUBLIC_SUPABASE_URL=https://ktrtheitjtwpdvdvnlzj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ANTHROPIC_API_KEY=sk-ant-api03-...
KLING_API_KEY=（待填写，从 piapi.ai 获取）
KLING_API_BASE=https://api.piapi.ai/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000</code></pre>

  <div class="file-label">app/api/cron/poll-tasks/route.ts（每分钟轮询）</div>
  <pre><code>import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/generation/provider'
import '@/lib/generation/kling-provider'

export const maxDuration = 60
export const dynamic = ‘force-dynamic’

export async function GET(request: Request) {
const authHeader = request.headers.get(‘authorization’)
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
return new Response(‘Unauthorized’, { status: 401 })
}

const supabase = await createClient()
const { data: tasks } = await supabase
.from(‘generation_tasks’)
.select(’*’)
.in(‘status’, [‘submitted’, ‘processing’])
.limit(20)

if (!tasks || tasks.length === 0) return NextResponse.json({ polled: 0 })

let completed = 0
for (const task of tasks) {
try {
const provider = getProvider(task.provider)
const status = await provider.checkStatus(task.provider_task_id!)

```
  if (status.status === 'completed' && status.video_url) {
    await supabase.from('generated_assets').insert({
      beat_id: task.beat_id,
      project_id: task.project_id,
      task_id: task.id,
      video_url: status.video_url,
      video_path: `assets/${task.project_id}/${task.beat_id}/v1.mp4`,
    })
    await supabase.from('beats').update({ status: 'reviewing' }).eq('id', task.beat_id)
    await supabase.from('generation_tasks').update({ status: 'completed' }).eq('id', task.id)
    completed++
  } else if (status.status === 'failed') {
    await supabase.from('generation_tasks')
      .update({ status: 'failed', error_message: status.error })
      .eq('id', task.id)
  }
} catch (e) { console.error(`Task ${task.id} poll error:`, e) }
```

}

return NextResponse.json({ polled: tasks.length, completed })
}</code></pre>

  <h3>测试流程（验证核心功能）</h3>
  <table>
    <tr><th>#</th><th>测试内容</th><th>期望结果</th></tr>
    <tr><td>1</td><td>叙事引擎：新建项目→粘贴Wolf Emperor EP1剧本→点"Analyze Script"</td><td>5-10秒后显示故事记忆库，包含角色、BEAT、伏笔地图</td></tr>
    <tr><td>2</td><td>角色上传：上传Luna和Caius的参考图→填写appearance描述</td><td>上传成功，显示角色卡片，状态变为"Ready"</td></tr>
    <tr><td>3</td><td>提示词生成：点击"Generate Prompts"→等待5-10秒</td><td>10个BEAT全部显示生成的英文提示词，场景分级A/B/C标注</td></tr>
    <tr><td>4</td><td>成本预估：点击"Generate All"→弹出成本预估对话框</td><td>显示beats数量/credits/USD，点击Confirm才开始生成</td></tr>
    <tr><td>5</td><td>并行生成：确认后查看任务列表，多个BEAT同时显示"Processing"</td><td>等待Cron Job轮询（最长1分钟），完成后显示视频缩略图</td></tr>
    <tr><td>6</td><td>一致性评分：生成完成后，点击任意BEAT的视频</td><td>显示0-10分的角色一致性分和叙事连贯性分</td></tr>
  </table>

  <div class="milestone">
    <div class="milestone-title">🎯 第一周唯一目标</div>
    <p>跑通「剧本→故事记忆库JSON」这条链（F01 parser）。其他14个P0功能在这条链跑通后依次接入。每完成一个功能，找一个真实创作者测试，记录反馈。</p>
  </div>

  <div class="warning">
    <strong>风险①</strong> Vercel Cron Jobs在免费计划只支持每日一次，需要Pro计划（$20/月）才能每分钟执行。开发阶段可以手动触发：直接访问 /api/cron/poll-tasks<br>
    <strong>风险②</strong> PiAPI的Kling接口参数可能与官方Kling API略有差异，建议先用单个BEAT测试
  </div>
</div>

<div style="background: #f59e0b11; border: 1px solid #f59e0b33; border-radius: 12px; padding: 24px; margin-top: 40px; text-align: center;">
  <div style="font-size: 18px; font-weight: 600; color: #f59e0b; margin-bottom: 8px;">全部8步完成 ✅</div>
  <p style="color: #94a3b8; font-size: 14px; margin: 0;">完整项目架构 → 数据库Schema → 类型定义 → 叙事引擎 → 角色管理 → 生成服务 → UI页面 → 部署配置</p>
  <p style="color: #64748b; font-size: 12px; margin-top: 8px; font-family: 'JetBrains Mono', monospace;">ScriptFlow · 46个摩擦点 · 9大模块 · 54个产品功能</p>
</div>

</div>
</body>
</html>