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
- `kling_tasks` API 目前存在 RLS 可能阻塞公开访问，已添加迁移 `20260327140000_disable_kling_tasks_rls.sql`，需在数据库执行并确认有效。
- `GenerateAllButton` 原先关闭弹窗后再跳转，现在改为直接跳转，需验证现实行为与预期一致。
- `finalizeScriptWizardProjectAction` 需从前端传入真实 `userId`，并由客户端获取登录用户；已改施行，但需在无用户/Token 寿命过期场景复测。
- 角色本地图片上传支持 HEIC 及预览已实现，但可能未处理生成失败回退行为，与旧版本兼容问题待测试。

## 5) 下一步待实现功能

- `kling_tasks` 完整后端任务流：从 `kling_tasks` status 监控到 `video_url` 写入，以及不同策略重试和失败报警。
- `app/en/project/[id]/shots` 增加分页/筛选和历史镜头回放模式。
- 将 `GenerateAllButtonHost` 的 `fire-and-forget` 生成任务由前端 API 调用改成任务队列，避免页面跳转失败或漏发。
- 在 `project` 页通过 `status` 展示任务概览（pending/processing/completed/failed）并提供刷新按钮。
- 权限和多租户：确保 `project_id` 仅属于当前登录用户可访问。

> 以后每完成一个功能，必须同步更新此文件以保持项目文档与代码同步。
