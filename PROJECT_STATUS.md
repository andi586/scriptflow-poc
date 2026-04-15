# Project Status

## 1) 已实现的 API 路由

- `app/api/audio/bgm/route.ts`  音频背景乐生成
- `app/api/audio/tts/route.ts`  文本转语音
- `app/api/character-templates/route.ts` 角色模板列表
- `app/api/character-templates/[id]/route.ts` 单条角色模板详情
- `app/api/download-video/route.ts` 视频下载代理
- `app/api/healthcheck/route.ts` 健康检查
- `app/api/nel/parse/route.ts` NEL 解析接口
- `app/api/projects/[id]/character-images/route.ts` 保存/读取项目角色图
- `app/api/projects/[id]/kling-tasks/route.ts` (新增) 读取 kling_tasks 状态
- `app/api/script/blueprint/route.ts` 剧本结构（蓝图）生成
- `app/api/script/develop/route.ts` 剧本开发（探索）接口
- `app/api/script/episode/route.ts` 集数生成接口
- `app/api/script/structure/route.ts` 剧本结构（细化）接口
- `app/api/video-proxy/route.ts` 视频代理
- `app/auth/callback/route.ts` 登录回调

## 2) 已实现的页面（路由）

- `app/page.tsx` 主页
- `app/login/page.tsx` 登录页
- `app/new-project/page.tsx` 新建项目页
- `app/dashboard/page.tsx` 通用仪表盘页
- `app/project/[id]/page.tsx` 项目概览
- `app/en/project/[id]/shots/page.tsx` 镜头状态页（已实现：每5秒刷新kling_tasks）
- `app/[locale]/(dashboard)/page.tsx` 本地化仪表盘
- `app/[locale]/(dashboard)/create/page.tsx` 本地化剧本创建
- `app/[locale]/(dashboard)/dashboard/page.tsx` 本地化仪表盘主要界面
- `app/[locale]/(dashboard)/new-project/page.tsx` 本地化新项目页
- `app/[locale]/(dashboard)/project/[id]/page.tsx` 本地化项目页
- `app/[locale]/(auth)/login/page.tsx` 本地化登录页
- `app/[locale]/(auth)/register/page.tsx` 本地化注册页
- `app/character-templates/page.tsx` 角色模板页

## 3) 数据库表列表

- `projects`
- `script_drafts`
- `characters`
- `character_templates`
- `summary_templates` (如有)
- `kling_tasks`（新增，包含 project_id、scene_index、status、video_url、error_message）
- `story_memory` 等（参照 migrations）

## 4) 当前已知Bug/需要修复的功能

- `shots` 页面报错：最初 `params.id` 未正确传入，已修复，需验证在所有 locale 及未登录情形下行为一致。
- `kling_tasks` API 目前存在 RLS 可能阻塞公开访问，已添加迁移 `20260327140000_disable_kling_tasks_rls.sql`，**需在 Supabase dashboard 执行该迁移并确认有效**。
- `finalizeScriptWizardProjectAction` 需从前端传入真实 `userId`，并由客户端获取登录用户；已实施（commit `2fcda16`），但需在无用户/Token 寿命过期场景复测。
- 角色本地图片上传支持 HEIC 及预览已实现，但可能未处理生成失败回退行为，与旧版本兼容问题待测试。

## 5) 下一步待实现功能

- `kling_tasks` 完整后端任务流：从 `kling_tasks` status 监控到 `video_url` 写入，以及不同策略重试和失败报警。
- `app/en/project/[id]/shots` 增加分页/筛选和历史镜头回放模式。
- 前端生成任务由 `fire-and-forget` 改成任务队列架构，避免并发重复请求。
- 在 `project` 页通过 `status` 展示任务概览（pending/processing/completed/failed）并提供刷新按钮。
- 权限和多租户：确保 `project_id` 仅属于当前登录用户可访问。

## 6) 最近完成的改进（本轮）

### ✅ 2026-03-27 生成流程可靠性与 UX 改进

**生成流程改进：**
- ✅ 修复 Project Owner：从 env var `SCRIPTFLOW_DEMO_USER_ID` → 实时获取登录用户 ID（commit `2fcda16`）
- ✅ 修复页面导航：生成后无 router.push → 添加 redirect 到 shots 页面（commit `febfd90` → `da036ec`）
- ✅ 支持 HEIC 格式：上传时自动转 JPEG（commit `b592bcb`）
- ✅ 图片预览：上传成功后显示 80x80 预览（commit `b592bcb`）
- ✅ API 可靠性：从 fire-and-forget IIFE → 改回 async/await （commit `e84a369`）
- ✅ 加载状态 UI：按钮禁用 + 文本变为"生成中…"（commit `d500ab3`）

**后端支持：**
- ✅ 镜头状态页：`app/en/project/[id]/shots/page.tsx`（commit `0a56d82`）
- ✅ API 端点：`app/api/projects/[id]/kling-tasks/route.ts`（commit `0a56d82`）
- ✅ 自动刷新：每 5 秒查询一次新的 `kling_tasks` 状态（commit `0a56d82`）
- ✅ 任务状态显示：pending(灰) → processing(蓝 spinner) → completed(绿 player) → failed(红 error)

**代码质量：**
- ✅ Promise params 处理：修复 Next.js 16.2 compatibility（commit `bb2cd3e`）
- ✅ 详细日志：5 级 console.log 追踪请求流（`[GENERATE CONFIRM]`、`[GENERATE REQUEST]`、`[GENERATE RESPONSE]`、`[GENERATE SUCCESS]`、`[GENERATE ERROR]`）
- ✅ API 日志：4 个检查点记录 tasks 查询（commit `bb2cd3e`）

**部署状态：**
- ✅ 全部已部署到 https://getscriptflow.com（commit `d500ab3`）

> 以后每完成一个功能，必须同步更新此文件以保持项目文档与代码同步。

## 重要教训（2026-03-27）

### 上午：旧流程验证
旧的create流程（getscriptflow.com首页）已端到端全通：剧本生成→Kling视频→视频播放。
新建的/en/project/[id]/shots页面是重复劳动，暂时废弃。
下一步：在旧create流程基础上添加配音TTS和BGM的UI，不要新建页面。

### 下午：新流程集成（2026-03-27 14:00-17:36）

**✅ 已完成：**
1. **Kling 任务提交成功**：在 `/en/project/[id]` 页面实现完整的视频生成流程
   - 从 `script_raw.structure.episodes` 提取剧本文本
   - 调用 `analyzeScriptAction` 生成 `story_memory`（NEL 分析）
   - 调用 `generateKlingPromptsAction` 生成提示词
   - 调用 `submitKlingTasksAction` 提交 6 个场景任务
   - 所有步骤都有详细的 console.log 日志

2. **新流程剧本→视频生成链路打通**：
   - `GenerateAllButtonHost.tsx` 实现角色锁定 + Kling 提交
   - 支持选择模板或上传自定义图片
   - 支持 HEIC 格式自动转换
   - 提交成功后显示绿色成功消息

3. **Middleware 白名单配置**：
   - `middleware.ts` 添加 `/project/` 路径白名单
   - `lib/supabase/middleware.ts` 添加 `/project/` 到 `isPublicPath`

**❌ 未解决的问题：**
1. **首页路由冲突**：
   - `getscriptflow.com` 首页被 middleware 重定向到 `/en/new-project`
   - 旧流程视频展示页面（`app/page.tsx`）无法直接访问
   - `/project/[id]` 路径会重定向到 `/en/dashboard`

2. **跳转到旧流程失败**：
   - 新流程 Kling 提交成功后尝试跳转到 `https://getscriptflow.com`
   - 但首页会被重定向，无法看到视频生成结果
   - 需要解决新旧流程共存的路由问题

**下一步计划：**
1. 解决首页路由冲突，让旧流程首页（`app/page.tsx`）能正常访问
2. 或者在新流程中直接显示视频生成结果，不跳转到旧流程
3. 统一新旧流程的视频展示逻辑

**技术债务：**
- 两套流程并存导致路由复杂度增加
- Middleware 重定向逻辑需要重新设计
- 需要明确新旧流程的边界和职责

---

## Day 30 - 2026年4月15日

### 🎯 今日核心里程碑

**"大脑开始工作了"** — Cognitive Core v1.0首次成功指挥完整视频生成

---

### ✅ 今日完成

**Cognitive Core v1.0（三模块大脑）**
- `app/lib/cognitive-core.ts` — Producer + Director + NEL三模块串行执行
- Producer Engine：一句话→世界观/角色/冲突/张力曲线
- Director Agent：故事→8镜头电影分镜计划（face/scene交替）
- NEL：分镜计划→可执行Pipeline JSON
- 使用claude-opus-4-6，质量显著提升

**Orchestrator统一调度器**
- `app/api/cron/orchestrator/route.ts` — 6步状态机
- Step1: 重试pending shots（最多3次）
- Step2: 轮询OmniHuman/Kling状态（直接查PiAPI）
- Step3: 轮询Shotstack per-shot合并
- Step4: 检测全部完成→触发最终concat
- Step5: 轮询最终渲染
- Step6: 自动恢复卡住的任务
- 替换process-kling和process-movies，统一调度

**声音克隆接入**
- `app/api/digital-twin/create/route.ts` — 建立分身时自动克隆声音
- Railway `/extract-audio` — FFmpeg提取音频
- ElevenLabs `/v1/voices/add` — 声音克隆
- `digital_twins.voice_id` — 存储克隆声音ID
- 视频生成时自动使用克隆声音

**Shotstack统一替换Railway**
- 所有视频合并操作统一使用Shotstack
- Railway只保留音频提取功能
- 彻底解决FFmpeg分辨率不匹配问题

**Dashboard升级**
- 实时监控：活跃电影进度条+每个shot状态彩色点
- 成本监控：今日成本/视频数/均价/盈亏平衡
- API服务状态面板：7个服务实时显示
- 盈亏平衡点：13部视频/月

**技术规范更新**
- `TECHNICAL_RULES.md` — 新增NEL优先原则
- 新增100分钟电影技术选型原则
- 新增Face镜头关键路径性能优化规则

---

### ❌ 已知问题

1. **声音腔调不稳定** — 克隆声音有时洋腔洋调，需要调整ElevenLabs参数
2. **镜头截断突兀** — face镜头台词有时被截断，缺少自然停顿
3. **Orchestrator状态混用** — 新旧状态值（submitted/processing vs omni_done/shot_complete）需要统一
4. **编剧质量不稳定** — Director有时生成低质量台词，需要更好的prompt
5. **Shotstack水印** — 免费版有水印，需要升级付费

---

### 📊 今日成本

- PiAPI消耗：约$20
- Vercel超额费用：$61.93
- 总计：约$82

---

### 🔬 今日产品洞察

**关键发现：Face镜头是生产关键路径**
- Scene镜头：Kling 2-3分钟完成
- Face镜头：Kling+OmniHuman+Shotstack = 6-10分钟
- 优化方向：Face镜头优先提交，未来OmniHuman缓存

**战略决策：工具只是四肢，NEL才是护城河**
- OmniHuman/Kling/ElevenLabs/Shotstack随时可替换
- NEL+Orchestrator是ScriptFlow真正的竞争壁垒
- LPM 1.0一旦开放API，直接替换OmniHuman

---

### 📅 明日计划（Day 31）

1. **用户系统** — 多用户数字分身隔离，My Videos按用户隔离
2. **收费系统** — Stripe接入，$9.99单次/$29.99订阅
3. **Cognitive Core优化** — Producer+Director prompt质量提升
4. **状态机统一** — 消除新旧状态值混用

---

### 💡 今日金句

> "大脑没有发育，建成了强大的四肢。今天大脑开始工作了。"

> "工具只是四肢，NEL才是护城河。目前他们只是猖狂了一时，未来鹿死谁手谁也不知道。"
