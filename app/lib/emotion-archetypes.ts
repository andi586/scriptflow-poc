export const EMOTION_ARCHETYPES = [
  {
    archetype: "late_regret",
    description: "意识到太晚的遗憾与无法挽回",
    blueprint: ["当下仪式", "物件触发", "记忆闪回", "压抑", "崩裂", "余韵"],
    symbolObjects: ["空椅子", "冷掉的饭", "旧语音"],
    forbiddenElements: ["说教台词", "哲学抽象", "过度解释"],
    musicArc: "无→低→渐强→静默",
    dialogueStyle: "断句+停顿+未说完"
  },
  {
    archetype: "playful_chaos",
    description: "轻松混乱的幽默事件",
    blueprint: ["突发混乱", "扩散", "反应", "对峙", "小高潮", "轻松收尾"],
    symbolObjects: ["碎物", "凌乱空间", "宠物"],
    forbiddenElements: ["严肃哲学", "沉重情绪"],
    musicArc: "无→轻→增强→轻收",
    dialogueStyle: "简短+轻松"
  },
  {
    archetype: "unspoken_love",
    description: "未说出口的情感",
    blueprint: ["对视", "接近", "犹豫", "错过", "沉默", "余韵"],
    symbolObjects: ["手", "目光", "未发送消息"],
    forbiddenElements: ["直白表白"],
    musicArc: "低→渐强→静默",
    dialogueStyle: "含蓄+省略"
  },
  {
    archetype: "lonely_reflection",
    description: "孤独中的自我思考",
    blueprint: ["孤人远景", "环境", "内心波动", "压抑", "微释放", "空镜"],
    symbolObjects: ["窗", "夜灯", "影子"],
    forbiddenElements: ["多人互动"],
    musicArc: "低→持续→淡出",
    dialogueStyle: "极少甚至无台词"
  },
  {
    archetype: "nostalgia",
    description: "对过去的怀念",
    blueprint: ["旧物", "触发", "回忆", "情绪浮现", "停顿", "回归现实"],
    symbolObjects: ["旧照片", "老物件", "光影"],
    forbiddenElements: ["现代干扰"],
    musicArc: "柔→持续→淡出",
    dialogueStyle: "轻声+回忆式"
  },
  {
    archetype: "heartbreak",
    description: "关系破裂的情感崩塌",
    blueprint: ["冲突开始", "升级", "断裂", "沉默", "释放", "余波"],
    symbolObjects: ["手机", "门", "空房间"],
    forbiddenElements: ["轻松化处理"],
    musicArc: "低→强→静",
    dialogueStyle: "断裂+情绪化"
  },
  {
    archetype: "hope",
    description: "困境中的希望",
    blueprint: ["低谷", "发现", "尝试", "挣扎", "突破", "光"],
    symbolObjects: ["光", "门", "天空"],
    forbiddenElements: ["彻底绝望结局"],
    musicArc: "低→渐强→明亮",
    dialogueStyle: "简短+坚定"
  },
  {
    archetype: "betrayal",
    description: "信任破裂",
    blueprint: ["信任", "裂缝", "发现", "冲击", "冷却", "距离"],
    symbolObjects: ["背影", "手机", "门"],
    forbiddenElements: ["快速原谅"],
    musicArc: "低→冲击→冷",
    dialogueStyle: "冷+短"
  },
  {
    archetype: "growth",
    description: "自我成长",
    blueprint: ["困境", "尝试", "失败", "再尝试", "突破", "稳定"],
    symbolObjects: ["路", "镜子", "手"],
    forbiddenElements: ["一蹴而就"],
    musicArc: "低→渐强",
    dialogueStyle: "内心式"
  },
  {
    archetype: "sacrifice",
    description: "为了他人放弃",
    blueprint: ["选择前", "冲突", "决定", "行动", "代价", "余韵"],
    symbolObjects: ["物品", "离开", "背影"],
    forbiddenElements: ["无代价"],
    musicArc: "低→强→静",
    dialogueStyle: "克制"
  },
  {
    archetype: "tension",
    description: "持续紧张",
    blueprint: ["异常", "积累", "对峙", "停顿", "爆发", "静"],
    symbolObjects: ["影子", "门", "呼吸"],
    forbiddenElements: ["轻松"],
    musicArc: "低→高→断",
    dialogueStyle: "少+短"
  },
  {
    archetype: "comfort",
    description: "被安慰与温暖",
    blueprint: ["痛苦", "接触", "理解", "放松", "依靠", "静"],
    symbolObjects: ["拥抱", "手", "光"],
    forbiddenElements: ["冲突"],
    musicArc: "柔→稳定",
    dialogueStyle: "轻声"
  },
  {
    archetype: "bittersweet",
    description: "甜中带苦",
    blueprint: ["快乐", "暗示", "转折", "情绪混合", "停顿", "余韵"],
    symbolObjects: ["笑与泪", "光影"],
    forbiddenElements: ["纯快乐"],
    musicArc: "柔→微强→淡",
    dialogueStyle: "轻+含蓄"
  },
  {
    archetype: "acceptance",
    description: "接受现实",
    blueprint: ["冲突", "抗拒", "疲惫", "停顿", "接受", "平静"],
    symbolObjects: ["放下物件", "呼气"],
    forbiddenElements: ["再次抗拒"],
    musicArc: "低→平",
    dialogueStyle: "简短"
  },
  {
    archetype: "reconciliation",
    description: "关系修复",
    blueprint: ["冲突遗留", "接近", "犹豫", "表达", "接受", "释放"],
    symbolObjects: ["手", "食物", "共同空间"],
    forbiddenElements: ["再次冲突"],
    musicArc: "低→温暖",
    dialogueStyle: "缓慢+真诚"
  },
  {
    archetype: "despair",
    description: "彻底无力的状态",
    blueprint: ["失败", "沉入", "停滞", "重复", "崩塌", "静止"],
    symbolObjects: ["黑暗", "空房", "静物"],
    forbiddenElements: ["积极转折"],
    musicArc: "低→无",
    dialogueStyle: "极少"
  },
  {
    archetype: "revenge",
    description: "压抑后的反击",
    blueprint: ["受压", "积累", "准备", "爆发", "执行", "冷却"],
    symbolObjects: ["刀具", "手", "阴影"],
    forbiddenElements: ["软弱处理"],
    musicArc: "低→紧张→爆发→静",
    dialogueStyle: "冷+短"
  },
  {
    archetype: "panic",
    description: "失控的紧张",
    blueprint: ["触发", "加速", "混乱", "爆发", "崩溃", "余波"],
    symbolObjects: ["呼吸", "手", "空间"],
    forbiddenElements: ["冷静处理"],
    musicArc: "高→更高→断",
    dialogueStyle: "断裂"
  },
  {
    archetype: "curiosity",
    description: "探索未知",
    blueprint: ["发现", "靠近", "观察", "变化", "理解", "停顿"],
    symbolObjects: ["细节物", "未知空间"],
    forbiddenElements: ["解释过多"],
    musicArc: "轻→渐强",
    dialogueStyle: "少"
  },
  {
    archetype: "awkward_silence",
    description: "尴尬与未说出口",
    blueprint: ["对视", "停顿", "小动作", "逃避", "停顿", "结束"],
    symbolObjects: ["桌子", "手", "眼神"],
    forbiddenElements: ["流畅对话"],
    musicArc: "无",
    dialogueStyle: "碎片化"
  }
]

export const DURATION_FORMULAS: Record<string, { shots: number; distribution: number[] }> = {
  "30s": { shots: 6, distribution: [3, 4, 5, 7, 6, 5] },
  "60s": { shots: 8, distribution: [4, 6, 8, 10, 12, 8, 6, 6] },
  "90s": { shots: 10, distribution: [5, 7, 9, 12, 14, 12, 10, 8, 7, 6] }
}

export function matchArchetype(story: string): string {
  const s = story.toLowerCase()

  const triggers = [
    { keywords: ["妈妈", "去世", "多年", "miss", "mom"], archetype: "late_regret" },
    { keywords: ["猫", "狗", "调皮", "cat", "dog", "pet"], archetype: "playful_chaos" },
    { keywords: ["喜欢", "爱你", "love", "romantic"], archetype: "unspoken_love" },
    { keywords: ["分手", "breakup", "离开"], archetype: "heartbreak" },
    { keywords: ["孤独", "lonely", "alone"], archetype: "lonely_reflection" },
    { keywords: ["童年", "小时候", "childhood"], archetype: "nostalgia" },
    { keywords: ["失败", "failed"], archetype: "despair" },
    { keywords: ["成功", "赢了", "success"], archetype: "growth" },
    { keywords: ["背叛", "betrayal"], archetype: "betrayal" },
    { keywords: ["希望", "hope"], archetype: "hope" },
    { keywords: ["家庭", "家人", "family", "爸", "父"], archetype: "reconciliation" },
    { keywords: ["回忆", "memory"], archetype: "nostalgia" },
    { keywords: ["害怕", "fear"], archetype: "panic" },
    { keywords: ["复仇", "revenge"], archetype: "revenge" },
    { keywords: ["压力", "stress"], archetype: "tension" },
  ]

  for (const trigger of triggers) {
    if (trigger.keywords.some(k => s.includes(k))) {
      return trigger.archetype
    }
  }

  return "bittersweet" // default
}
