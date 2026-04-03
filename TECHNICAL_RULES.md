# ScriptFlow 永久技术规则文档
最后更新：2026-04-03

## 一、路由规则

### 规则1：所有redirect必须指向实际存在的路径
**症状：** 页面反复横跳，导航死循环
**根本原因：** middleware.ts里redirect到了/en/xxx，但/en/目录不存在
**解决方案：** 所有redirect统一指向/app-flow，不用/en/前缀
**涉及文件：** lib/supabase/middleware.ts
**永久规则：** 新增任何redirect前，先确认目标路径真实存在

---

## 二、数据库规则

### 规则2：SUPABASE_SERVICE_ROLE_KEY用于内部API
**症状：** 内部API调用Supabase返回权限错误
**根本原因：** 用了anon key而不是service role key
**解决方案：** 所有内部pipeline API必须用SUPABASE_SERVICE_ROLE_KEY
**永久规则：** 内部API = service role key，前端 = anon key

### 规则3：Railway服务必须手动部署
**症状：** 推送代码后Railway没有更新
**根本原因：** Railway不会自动从GitHub部署
**解决方案：** 每次修改Railway相关代码后必须执行railway up
**永久规则：** railway up是必须的手动步骤

### 规则4：UPDATE返回"No rows returned"不代表失败
**症状：** Supabase执行UPDATE显示No rows returned
**根本原因：** Supabase SQL Editor对UPDATE不显示affected rows
**解决方案：** 执行SELECT确认数据是否已更新
**永久规则：** UPDATE​​​​​​​​​​​​​​​​

cat > TECHNICAL_RULES.md << 'EOF'
# ScriptFlow 永久技术规则文档
最后更新：2026-04-03

## 一、路由规则

### 规则1：所有redirect必须指向实际存在的路径
**症状：** 页面反复横跳，导航死循环
**根本原因：** middleware.ts里redirect到了/en/xxx，但/en/目录不存在
**解决方案：** 所有redirect统一指向/app-flow
**永久规则：** 新增任何redirect前，先确认目标路径真实存在

## 二、数据库规则

### 规则2：SUPABASE_SERVICE_ROLE_KEY用于内部API
**永久规则：** 内部API = service role key，前端 = anon key

### 规则3：Railway服务必须手动部署
**永久规则：** 每次修改Railway代码后必须执行railway up

### 规则4：UPDATE返回"No rows returned"不代表失败
**永久规则：** UPDATE后必须SELECT验证

### 规则5：projects表status是枚举类型
**合法值：** draft → analyzing → ready → generating → completed → archived

## 三、Pipeline规则

### 规则6：script_raw存在于projects表
**永久规则：** 剧本数据永远在projects.script_raw

### 规则7：kling_tasks.status成功值是"success"
**永久规则：** Kling任务成功状态 = "success"

### 规则8：scene_index不是shot_index
**永久规则：** 永远用scene_index

### 规则9：所有API路由必须设置maxDuration=300
**永久规则：** 所有调用AI服务的API必须加maxDuration=300

### 规则10：Cloud merge显示失败先去Supabase找视频
**永久规则：** 看到Cloud merge failed先去Supabase Storage找视频

### 规则11：剧本生成阶段不能切换页面
**永久规则：** 视频生成阶段可以切换，剧本生成阶段不能切换

## 四、ElevenLabs规则

### 规则12：四个角色Voice ID
- Caius：pNInz6obpgDQGcFmaJgB（Adam）
- Luna：cgSgspJ2msm6clMCkdW9（Jessica）
- Marcus：SOYHLrjzK2X1ezoPC6cr（Harry）
- Narrator：onwK4e9ZLuTAKqWW03F9（Daniel）
**永久规则：** Voice ID必须先Add到My Voices才能调用

## 五、iOS规则

### 规则13：iOS视频下载必须用Web Share API
**组件：** components/VideoDownloadButton.tsx
**永久规则：** iOS下载走Web Share API，Android/桌面走download属性

### 规则14：iOS Safari分享菜单没有TikTok
**永久规则：** 指导用户保存到相册，再从TikTok上传

## 六、My Projects规则

### 规则15：My Projects用URL参数传递项目ID
**永久规则：** 跳转历史项目用/app-flow?projectId=xxx

### 规则16：app-flow初始化会清除localStorage
**永久规则：** 修改session逻辑前先检查mount时的清除逻辑

## 七、环境变量规则

### 规则17：Vercel环境变量修改后必须Redeploy
**永久规则：** 改环境变量必须Redeploy才生效

### 规则18：关键环境变量清单
- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID_CAIUS/LUNA/MARCUS/NARRATOR
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PIXABAY_API_KEY

## 八、品牌规则

### 规则19：域名资产
- 产品工具：getscriptflow.com
- 品牌情感：heavencinema.ai

### 规则20：广告语
- 中文：天堂电影院，你来当导演！
- 英文：Direct Your Heaven.
