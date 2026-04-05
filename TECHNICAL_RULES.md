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

## 九、历史Bug修复记录（从Git历史整理）

### 规则21：/en/*路由全部是死路
**Commit：** 4eee1c7
**症状：** redirect到/en/xxx导致404死循环
**解决方案：** 全部改成/app-flow
**永久规则：** 永远不要新增/en/前缀的路由

### 规则22：My Projects 401要静默处理
**Commit：** 25e7aeb
**症状：** 未登录用户访问My Projects卡死
**解决方案：** 401返回时显示空列表不抛错误
**永久规则：** API返回401时前端静默处理

### 规则23：finalize的prompt必须截断到4000字符
**Commit：** 069d890
**症状：** finalize调用Claude超时
**解决方案：** dialogue extraction prompt截断<4000字符
**永久规则：** 传给Claude的prompt必须控制在4000字符以内

### 规则24：视频下载必须buffer整个文件
**Commit：** 6b9744d
**症状：** 下载的视频缺少音轨
**解决方案：** buffer整个文件再返回，不用stream
**永久规则：** 视频下载必须完整buffer

### 规则25：episode_number从projects表读取传给Railway
**Commit：** c30f175, df6696f
**症状：** 片头字幕显示错误集数
**解决方案：** 从projects.episode_number读取传给Railway
**永久规则：** 集数编号永远从projects.episode_number读取

### 规则26：新建项目时自动设置episode_number
**Commit：** 7c79b13
**症状：** episode_number为null导致片头显示Episode 1
**解决方案：** 创建项目时COUNT现有项目数+1自动写入
**永久规则：** createProjectAction必须自动计算episode_number

### 规则27：ELEVENLABS_VOICE_ID未设置时跳过TTS
**Commit：** ce76e51
**症状：** Voice ID未设置时整个pipeline失败
**解决方案：** 检测到无Voice ID时跳过TTS继续Railway merge
**永久规则：** TTS失败不能阻断整个pipeline

### 规则28：iOS下载最终方案
**Commits：** 0955472, f04fdf0, 25acf92
**症状：** iOS无法下载视频到相册
**最终解决方案：** VideoDownloadButton.tsx
- iOS：fetch→Blob→File→navigator.share()
- Android/桌面：直接download属性
**永久规则：** 不要再尝试其他iOS下载方案

### 规则29：手机端middleware不能redirect到不存在的路径
**Commit：** e711de5
**症状：** 手机端新用户进来死循环
**根本原因：** middleware redirect到/en/login和/en/dashboard
**解决方案：** 改成/login和/app-flow
**永久规则：** middleware的所有redirect目标必须真实存在

### 规则30：Start New Project必须清除localStorage再跳转
**Commits：** 900b1d6, e944796
**症状：** 点击新建后仍然恢复旧session
**解决方案：** 清除localStorage四个key后window.location.href='/app-flow'
**永久规则：** 新建项目前必须清除所有session localStorage

### 规则31：session restore空页面要显示友好提示
**Commit：** 2b98091
**症状：** 恢复session后页面空白
**解决方案：** effectiveIds为空时显示"No scenes found"而不是null
**永久规则：** 所有空状态必须显示友好提示，不能return null

### 规则32：My Projects点击项目用URL参数传递
**Commits：** e0b5ad4, 45cc02d, af948fd
**症状：** 点击历史项目后页面空白找不到项目
**解决方案：** 跳转到/app-flow?projectId=xxx，页面读URL参数设置restoredLazySessionId
**永久规则：** 历史项目跳转必须带URL参数，不依赖localStorage

### 规则33：video modal需要crossOrigin属性
**Commit：** 3c306b4
**症状：** Modal里的视频无法播放，播放按钮灰色
**解决方案：** video标签加crossOrigin="anonymous"
**永久规则：** 所有跨域视频标签必须加crossOrigin="anonymous"

### 规则34：异步架构render_jobs表
**Commits：** 8b1c063, 08c5427, 4cfd9fa
**症状：** 切换页面pipeline中断
**解决方案：** 创建render_jobs表，提交任务后立刻返回jobId
**相关文件：** app/api/render-jobs/route.ts, components/render-job-progress.tsx
**永久规则：** 所有长任务必须走render_jobs异步架构

### 规则35：Landing页Hero视频随最新集更新
**规则：** 每发布新一集Wolf Emperor，更新app/page.tsx中的DEMO_VIDEO_URL和HERO_VIDEO_URL
**命令：** sed -i '' 's|旧文件名.mp4|新文件名.mp4|g' app/page.tsx


### 规则36：Landing页Hero视频自动从数据库读取
**API：** /api/latest-video
**逻辑：** 读取projects表最新的final_video_url
**永久规则：** 不要再手动修改DEMO_VIDEO_URL，每次发新集自动更新

### 规则37：F84质检只拦截三无产品
**原则：** 保住底线，不追求完美
**三无定义：**
- 无影：无视频流或时长<5秒
- 无声：无音频流
**永久规则：** 质检不误杀正常视频

### 规则38：HumanTouch Engine参数
**视频：** eq=contrast=1.05:saturation=0.92
**音频：** loudnorm=I=-16:LRA=11:TP=-1.5
**永久规则：** noise和gblur会损坏视频不要加

### 规则39：Cinema Bazaar数据表
**market_assets表：** 存储所有上架资产
**asset_purchases表：** 存储购买记录
**永久规则：** 65%归卖家，Wyoming LLC完成后接入Stripe Connect结算

## 十、产品体验规则

### 规则41：用户必须先看到故事再选角色
**症状：** 用户盲审角色，不知道故事内容
**正确流程：**
输入一句话→显示三幕结构+故事概要→用户确认→选角色/上传图片
**永久规则：** 角色选择步骤必须在故事预览之后

### 规则42：生成前必须显示报价弹框
**症状：** 用户不知道要消耗多少credits
**正确流程：**
确认角色→弹出报价（预计credits/时间/费用）→用户确认→开始生成
**永久规则：** 任何消耗credits的操作前必须显示报价弹框

### 规则43：SSH端口被封时用443端口推送
**症状：** ssh: connect to host github.com port 22: Undefined error
**解决：** git push ssh://git@ssh.github.com:443/andi586/scriptflow-poc.git main
**永久规则：** 泰国网络不稳定时用443端口绕过

### 规则45：Seedance 2.0已在PiAPI上线
日期：2026-04-05
Seedance 2.0可通过PiAPI调用
加入F80多供应商候选列表
评估后决定是否接入
