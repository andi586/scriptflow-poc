# SquadCast™ 技术规范
日期：2026-04-03
级别：全球首创，增长核武器

## 命名
SquadCast™（立刻注册商标）

## 核心定位
单人产品是工具，多人产品是病毒。
用户不是在用AI生成内容，而是在用AI表达真实的人际关系。

## 用户流程
Step 1：一句话输入剧情
Step 2：上传2-5人真实照片
Step 3：AI自动分配角色
Step 4：直接生成（无确认弹框）
Step 5：等待页提前传播（Tag your friends）
Step 6：结果页病毒引擎全开

## 角色自动分配逻辑
- 第一张照片（你）→ 自动主角
- Friend 1 → 搭档
- Friend 2 → 反派（概率机制）
- Friend 3 → 喜剧担当
- Friend 4/5 → NPC
- 用户可拖拽调整

## 照片上传规范

### 技术要求
- 分辨率：≥512x512（推荐1024）
- 格式：JPG/PNG
- 人脸占比：≥40%
- 文件大小：<5MB
- 每张只能一个人脸

### 拍摄要求
✅ 正脸或轻微侧脸（±45度以内）
✅ 光线均匀，面部清晰
✅ 简单背景
✅ 自然表情
❌ 不能戴墨镜/口罩
❌ 不能多人合照
❌ 不能模糊/逆光
❌ 不能过度美颜

### 内容安全
- 上传前勾选"所有照片已获当事人同意"
- AI自动检测未成年人（<18岁拦截）
- 不能上传公众人物照片
- 照片7天后自动删除（可选择永久保存）

### 质量检测
≥85分：自动通过
70-84分：黄色警告 + "AI Enhance"选项
<70分：友好提示重新拍摄

### 失败提示原则
❌ 不说："Upload failed / Error"
✅ 说："We couldn't see your face clearly 😅
        Try better lighting or move closer"

## 病毒传播机制

### 分享结构
1个主链接 + N个朋友专属视角链接

### 主链接文案
"Me and my friends made a movie 😂
#SquadCast #MyFriendsAreStars"

### 朋友专属链接
"Bro you're literally the villain 💀"
→ 自动跳到该朋友出现的片段

### TikTok自动文案
"POV: My squad just became movie stars 😱
Starring @friend1 @friend2 @friend3
Made in 12 min with ScriptFlow
#SquadCast #MyFriendsAreStars"

## 标准案例（创始人原创）
剧情："我喝醉了打醉拳，
把哥们打成狗，又打成猪，
最后又打回来。"

传播逻辑：
- 整人的爽 + 被整的爽 + 旁观者的爽
- 三方同时传播 = 病毒裂变

## Cinema Glow™（美颜功能）
定位：不是遮丑，是给每个人电影级打光

三档设计：
- Natural（默认）：轻微磨皮，均匀肤色
- Cinema（推荐）：影视级修饰，增加质感
- Raw：完全不处理

文案原则：
❌ 不说Beauty filter
✅ 说"Cinema Glow™ - Every star gets their best light"

## 数据表设计
squad_projects（项目表）
- id, owner_id, script, video_url, created_at

squad_members（成员表）
- id, project_id, name
- face_image_url, role
- scene_timestamps[]
- share_token（每人专属）

## 竞品分析
全球首创，无直接竞品
现有工具都是：单人换脸/专业视频生成/虚拟AI演员
ScriptFlow SquadCast：
- 多人真实朋友 ✅
- 自动剧情生成 ✅
- 智能角色分配 ✅
- 个人视角分享链接 ✅

## 预计开发时间
MVP：4-5天
Day1：上传UI + Supabase表结构
Day2：照片质量检测 + 角色分配逻辑
Day3：Kling多参考图调用
Day4：专属分享链接系统
Day5：病毒文案 + 测试上线

## 三重爽点理论
爽点一：我当主角（明星梦）
爽点二：整朋友（调侃欲）
爽点三：被整（被关注的满足感）

三重爽点叠加 = 三方同时传播 = 病毒裂变

## 增长飞轮公式
1个用户
→ 上传4个朋友照片
→ 4个人同时收到专属视频
→ 每人再拉4个朋友
→ 指数级爆炸
