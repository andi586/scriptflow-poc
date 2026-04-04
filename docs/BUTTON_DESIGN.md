
---

## 法律风险告知设计
日期：2026-04-04

### 触发时机
用户点击上传照片前强制显示
必须勾选才能继续

### 告知内容（英文）
标题：Before you upload 📋

正文：
By uploading photos, you confirm:

✅ You have the consent of every person
   whose photo you are uploading

✅ For minors under 18, you confirm
   you are their parent or legal guardian
   and you consent on their behalf

✅ Photos will only be used to generate
   your requested video

✅ Photos are stored securely and
   deleted after 7 days unless you
   choose to save them

✅ You will not upload photos of
   public figures or celebrities

✅ Generated content must not be used
   to defame, harass, or harm anyone

[☐ I understand and agree]
[Continue →]

### 设计原则
不是吓退用户
而是保护平台和用户双方
勾选后不再重复显示（记住选择）
语言友好不冷冰冰

### 未成年人专项提示
如果AI检测到照片可能是未成年人
额外弹出：
"This person appears to be under 18.
 Please confirm you are their parent
 or legal guardian before continuing."
[I confirm] [Remove this photo]

### 平台免责
所有生成内容底部自动添加：
"AI-generated content.
 For entertainment purposes only.
 Made with ScriptFlow."

---

## 编号命运系统最终定义
日期：2026-04-04
创始人更新

#1 = The Fate Writer（命运编写者）
#2-#10 = 命运接受者

不是"听天由命"
而是"听#1的命"

上传界面：
⭐ #1 — The Fate Writer. You hold the pen.
🎭 #2 — Awaiting their fate
🎭 #3 — Awaiting their fate

输入框提示：
"You are #1 — the Fate Writer.
Use #2 to #10 to write their destiny."

广告语：
"You write the code.
They live the story."

---

## 最终交互逻辑 V4.0
日期：2026-04-04
创始人决策

### 核心改变
输入框不再独立存在
而是内嵌在身份按钮里

### 页面结构
Direct Your Heaven.

[⭐ Be the Star]
[🎬 Be the Director]

点击Be the Star后展开：
- 动态照片上传槽位
  #1 The Fate Writer ⭐
  #2 Awaiting fate 🎭
  #3 Awaiting fate 🎭
  ...永远多一个空位，最多10个
- 故事输入框
  "Describe your story...
   Use #2 #3 to write their fate."
- Spark Chaos ⚡（仅Star页面有）
- Generate按钮

点击Be the Director后展开：
- 故事输入框
  "Describe your story..."
- Generate按钮
（无Spark Chaos，干净专业）

### Spark Chaos位置规则
✅ 只在Be the Star里出现
❌ 不在Be the Director里出现

### 逻辑顺序
先选身份 → 再输入故事
不是先输入再选身份
