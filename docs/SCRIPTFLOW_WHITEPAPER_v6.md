# ScriptFlow 白皮书 v6.0
更新日期：2026-04-06（Day 28）
版本说明：在v5.0基础上，加入产品灵魂顿悟和NEL v2.0升级

---

## 产品定义（v6.0新增）

**ScriptFlow是一扇门。**

门的这边：你是谁你就是谁
门的那边：你是你想成为的任何人

Tagline：
- EN: "Step through the door. Become anyone."
- CN: "推开这扇门，你就是你想成为的人"

设计原则：
"用最轻的结构，最简单的架构，完成一个奇妙的梦"

---

## 两扇门路线图

**门一（现在）：Be the Star**
我是我想成为的英雄/国王/歌星

**门二（未来）：礼物式创作**
我让你成为你值得成为的人
- 给朋友生日做一部电影
- 让老婆成为女王
- 让孩子成为超级英雄
- 让父母成为电影明星

---

## 核心数据（v6.0更新）

- 摩擦点：58个（新增Pain Point #28 iOS视频保存）
- 技术规则：45条
- 产品功能：F1-F90
- 三大护城河：NEL叙事引擎、HTS人类标准、F80多供应商容错

---

## NEL v2.0 视觉圣经（Day 28新增）

### 五层架构
- Layer 1: Story Seed（语言检测+类型识别+时代判断）
- Layer 2: Narrative Plan（Claude只写剧情beats+台词）
- Layer 3: Visual Bible Builder（自动推断服装/场景）
- Layer 4: Prompt Compiler（压缩到800字符，硬锁视觉一致性）
- Layer 5: Voice Mapper（4声音智能分配）

### character_bible结构
每个角色包含：
- id / localName / visualNameEn / gender
- archetype（gangster_boss_male / ancient_emperor等）
- look：hair / outfit / shoes / accessory / palette
- negatives：["no bare chest", "no sandals"...]
- voiceSlot：Caius / Luna / Marcus / Narrator

### scene_bible结构
- era：ancient / modern / future / fantasy
- location / environment / palette
- propsBan：禁止出现的物品

### Prompt Compiler规则
格式：[角色固定描述], [场景锚点], [动作],
consistent outfit throughout, no [forbidden items]
总字符控制在800以内

### 男性角色强制约束（运行时注入）
- "no bare chest"
- "no shirtless"
- "fully clothed at all times"

---

## 界面极简化（Day 28完成）

**Be the Star只有三个元素：**
1. Drop your photo here 📸
2. Speak or type your story...
3. Make the Movie ✨

**删除的UI：**
- 时长选择器（默认My Moment=5镜头）
- Cinema Glow档位选择（默认Cinema）
- 所有说明文字

---

## 等待仪式（Day 28完成）

主标题：The door is opening.

轮换文案（顺序）：
1. Leave this world.
2. Step through.
3. You are becoming.
4. A new life begins.
5. Your story is forming.
6. Fate is rewriting you.
7. This is your world.
8. You chose this life.
9. They will remember you.
10. Your world awaits.

最后30秒：The curtain rises.

---

## Wolf Emperor内容系统（Day 28建立）

### 故事圣经
- 世界观：现代都市+狼族血统隐喻权力
- Caius（狼王/CEO）：32岁，金眸觉醒
- Luna（女主）：26岁，后期觉醒月影之狼
- Marcus（反派）：35岁，毒狼血脉

### Season 1大纲（24集）
- EP1-7（已发）：初次碰撞
- EP8-14：欲望觉醒
- EP15-20：背叛风暴
- EP21-24：皇位之战

### TikTok爆款公式
- 最佳时长：60-90秒
- 每15秒一个情绪转折
- 每集必有cliffhanger
- 发布频率：每周5集，北美东部时间晚8点

---

## PWA配置（Day 28完成）

- manifest.ts已配置
- apple-mobile-web-app-capable: yes
- iOS视频保存：Web Share API代理接口
- 用户可添加到主屏幕，体验如原生App

---

## 商业进展（Day 28）

- Wyoming LLC：已成立（Northwest Registered Agent）
- EIN：朋友代办打电话给IRS（已安排）
- Mercury Bank → Stripe：EIN到手后立即执行
- 域名：getscriptflow.com（heavencinema.ai 301重定向）

---

## 技术规则更新（Day 28）

- 规则44：Google Veo 3.1 Lite加入F80供应商候选
- 规则45：Seedance 2.0已在PiAPI上线
- 共45条永久技术规则

---

## Pain Points累计（截至Day 28）

新增Pain Point #28：
iOS用户无法从My Projects直接保存视频到相机胶卷
解决方案：Web Share API代理接口（已完成）

---

## 迭代路线图

**近期（已完成）：**
✅ NEL v2.0视觉圣经
✅ 界面极简化
✅ 等待仪式
✅ 服装连续性锁定
✅ PWA配置

**中期（武器库）：**
- NEL多模态反馈环
- 门二：礼物式创作
- Heaven Feed内容生态
- Cinema Bazaar资产市场

**长期（等待技术飞跃）：**
- 角色真正开口说话（嘴型同步）
- AI真正看到生成的画面
- 完整的AI导演系统

---

*"用最轻的结构，最简单的架构，完成一个奇妙的梦"*
*ScriptFlow v6.0 · 2026-04-06 · Day 28*
