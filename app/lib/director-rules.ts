export const DIRECTOR_RULES = [
  {
    archetype: "pet_daily",
    directorRules: ["开场必须是动作特写（爪子/尾巴触发事件）", "第2镜必须展示环境变化", "至少1个反应镜头", "高潮必须是混乱最大化瞬间", "结尾必须回归平静形成反差"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "handheld playful",
    lightingDirective: "bright natural",
    pacingDirective: "fast escalation then drop",
    dialogueDirective: "max 6 words, humorous",
    musicDirective: "playful rhythm, peak at shot 5"
  },
  {
    archetype: "food_explore",
    directorRules: ["开场必须是食物极致特写", "第2镜展示整体摆盘", "必须有入口前停顿镜头", "高潮是第一口反应", "结尾必须是余味"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "smooth macro",
    lightingDirective: "warm appetizing",
    pacingDirective: "medium then peak",
    dialogueDirective: "max 5 words",
    musicDirective: "upbeat, drop at bite"
  },
  {
    archetype: "travel_memory",
    directorRules: ["开场必须是大景", "第2镜才允许人物出现", "至少2个移动镜头", "高潮必须是最壮观景观", "结尾必须是日落或远景"],
    shotSequence: "scene→scene→face→scene→scene→scene",
    cameraStyle: "wide cinematic",
    lightingDirective: "natural golden hour",
    pacingDirective: "gradual build",
    dialogueDirective: "minimal",
    musicDirective: "uplifting swell"
  },
  {
    archetype: "fitness_journey",
    directorRules: ["开场必须是疲惫或汗水特写", "必须展示重复动作", "至少1个失败镜头", "高潮是突破动作", "结尾是静止呼吸"],
    shotSequence: "scene→face→face→scene→scene→face",
    cameraStyle: "handheld intense",
    lightingDirective: "hard contrast",
    pacingDirective: "fast rhythmic",
    dialogueDirective: "none or 3 words",
    musicDirective: "strong beat, peak at shot 5"
  },
  {
    archetype: "baby_growth",
    directorRules: ["开场必须是细节（手/眼）", "镜头必须低机位", "至少1个互动镜头", "高潮是笑或情绪爆发", "结尾必须温柔静止"],
    shotSequence: "scene→face→face→scene→face→scene",
    cameraStyle: "soft handheld",
    lightingDirective: "soft warm",
    pacingDirective: "slow gentle",
    dialogueDirective: "whisper tone",
    musicDirective: "soft lullaby"
  },
  {
    archetype: "prank_friend",
    directorRules: ["开场必须隐藏信息", "必须有等待镜头", "触发必须突然", "高潮是反应", "结尾必须笑或崩溃"],
    shotSequence: "scene→scene→scene→face→face→scene",
    cameraStyle: "handheld chaotic",
    lightingDirective: "natural",
    pacingDirective: "fast spike",
    dialogueDirective: "short reactions",
    musicDirective: "comic hit"
  },
  {
    archetype: "comeback_story",
    directorRules: ["开场必须低谷画面", "必须有失败镜头", "中段展示努力", "高潮是逆转", "结尾必须定格胜利"],
    shotSequence: "scene→face→face→scene→scene→face",
    cameraStyle: "dynamic",
    lightingDirective: "dark to light",
    pacingDirective: "build then explode",
    dialogueDirective: "short powerful",
    musicDirective: "epic rise"
  },
  {
    archetype: "bestfriend_bond",
    directorRules: ["开场必须是互动瞬间", "必须有笑点", "至少1个回忆镜头", "高潮是共同情绪", "结尾必须温暖定格"],
    shotSequence: "scene→face→scene→face→scene→scene",
    cameraStyle: "natural",
    lightingDirective: "warm",
    pacingDirective: "medium",
    dialogueDirective: "casual",
    musicDirective: "upbeat"
  },
  {
    archetype: "spring_festival",
    directorRules: ["开场必须是红色元素", "必须有家庭场景", "至少2个群体镜头", "高潮是欢笑或团聚", "结尾必须温暖收束"],
    shotSequence: "scene→scene→face→scene→scene→scene",
    cameraStyle: "stable",
    lightingDirective: "warm festive",
    pacingDirective: "steady",
    dialogueDirective: "family tone",
    musicDirective: "festive"
  },
  {
    archetype: "misunderstanding_resolved",
    directorRules: ["开场必须冲突状态", "中段必须沉默", "解释必须延迟", "高潮是理解瞬间", "结尾必须平静"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "static tension",
    lightingDirective: "neutral",
    pacingDirective: "slow build",
    dialogueDirective: "realistic",
    musicDirective: "emotional release"
  },
  {
    archetype: "martial_arts",
    directorRules: ["开场必须是脚步或手部特写", "必须有对峙镜头", "动作必须分层递进", "高潮必须慢动作", "结尾必须静止"],
    shotSequence: "scene→face→scene→scene→scene→scene",
    cameraStyle: "dynamic tracking",
    lightingDirective: "high contrast",
    pacingDirective: "fast rhythmic",
    dialogueDirective: "minimal",
    musicDirective: "rhythmic impact"
  },
  {
    archetype: "wedding_memory",
    directorRules: ["开场必须是细节特写（戒指/花）", "人物必须第2镜后出现", "至少1个慢动作", "高潮是情感对视", "结尾必须留白"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "slow cinematic",
    lightingDirective: "warm soft",
    pacingDirective: "slow build",
    dialogueDirective: "max 8 words",
    musicDirective: "romantic swell"
  },
  {
    archetype: "birthday_celebration",
    directorRules: ["开场必须黑暗+蜡烛", "必须有等待镜头", "触发必须突然", "高潮是吹蜡烛", "结尾必须笑声"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "handheld",
    lightingDirective: "warm",
    pacingDirective: "fast",
    dialogueDirective: "short",
    musicDirective: "happy peak"
  },
  {
    archetype: "graduation_memory",
    directorRules: ["开场必须校园", "必须有回忆镜头", "高潮必须抛帽", "必须有群体镜头", "结尾远景"],
    shotSequence: "scene→scene→face→scene→scene→scene",
    cameraStyle: "wide",
    lightingDirective: "natural",
    pacingDirective: "medium",
    dialogueDirective: "minimal",
    musicDirective: "uplifting"
  },
  {
    archetype: "fail_moments",
    directorRules: ["开场必须正常动作", "失败必须突然", "必须保留完整失败过程", "高潮是跌倒/错误瞬间", "结尾冻结"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "handheld",
    lightingDirective: "natural",
    pacingDirective: "fast",
    dialogueDirective: "none",
    musicDirective: "comic hit"
  },
  {
    archetype: "pet_funny",
    directorRules: ["开场必须宠物异常行为", "必须有反应镜头", "动作必须夸张", "高潮是混乱", "结尾回归平静"],
    shotSequence: "scene→scene→face→face→scene→scene",
    cameraStyle: "playful",
    lightingDirective: "bright",
    pacingDirective: "fast",
    dialogueDirective: "minimal",
    musicDirective: "playful"
  },
  {
    archetype: "awkward_daily",
    directorRules: ["开场必须正常互动", "必须出现微尴尬", "中段必须沉默", "高潮是眼神回避", "结尾必须停顿"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "static",
    lightingDirective: "neutral",
    pacingDirective: "slow awkward",
    dialogueDirective: "fragmented",
    musicDirective: "light awkward"
  },
  {
    archetype: "viral_loop_prank",
    directorRules: ["开场必须是结尾画面", "结构必须闭环", "触发必须强刺激", "高潮是反应", "结尾必须回到开头"],
    shotSequence: "scene→scene→scene→face→scene→scene",
    cameraStyle: "fast cuts",
    lightingDirective: "bright",
    pacingDirective: "very fast",
    dialogueDirective: "short",
    musicDirective: "loop"
  },
  {
    archetype: "quick_emotion_hit",
    directorRules: ["开场必须强钩子", "情绪必须在3镜内建立", "高潮必须在第4镜", "必须有停顿", "结尾留白"],
    shotSequence: "scene→face→face→face→scene→scene",
    cameraStyle: "tight",
    lightingDirective: "contrast",
    pacingDirective: "fast",
    dialogueDirective: "max 6 words",
    musicDirective: "spike"
  },
  {
    archetype: "training_grind",
    directorRules: ["开场必须疲惫", "必须重复动作", "必须有失败", "高潮是突破", "结尾静止"],
    shotSequence: "scene→face→scene→scene→scene→face",
    cameraStyle: "handheld",
    lightingDirective: "hard",
    pacingDirective: "fast",
    dialogueDirective: "none",
    musicDirective: "intense"
  },
  {
    archetype: "startup_hustle",
    directorRules: ["开场必须工作细节", "必须有压力镜头", "必须有失败", "高潮是成功信号", "结尾冷静"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "dynamic",
    lightingDirective: "mixed",
    pacingDirective: "fast",
    dialogueDirective: "short",
    musicDirective: "build"
  },
  {
    archetype: "exam_victory",
    directorRules: ["开场必须是紧张细节（笔/手）", "必须有等待结果镜头", "必须有情绪压抑阶段", "高潮是结果揭示", "结尾必须释放呼吸"],
    shotSequence: "scene→face→face→scene→face→scene",
    cameraStyle: "tight focus",
    lightingDirective: "neutral cool",
    pacingDirective: "build tension then release",
    dialogueDirective: "minimal",
    musicDirective: "build then drop"
  },
  {
    archetype: "brotherhood",
    directorRules: ["开场必须并肩画面", "必须有冲突瞬间", "必须有信任建立", "高潮是互相支持", "结尾必须共同离开"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "steady",
    lightingDirective: "contrast warm",
    pacingDirective: "medium",
    dialogueDirective: "short direct",
    musicDirective: "strong emotional"
  },
  {
    archetype: "teacher_student",
    directorRules: ["开场必须教学环境", "必须有困惑表情", "必须有指导动作", "高潮是顿悟", "结尾必须点头或眼神"],
    shotSequence: "scene→face→face→scene→scene→face",
    cameraStyle: "stable",
    lightingDirective: "soft neutral",
    pacingDirective: "slow build",
    dialogueDirective: "clear short",
    musicDirective: "inspiring rise"
  },
  {
    archetype: "colleague_story",
    directorRules: ["开场必须工作场景", "必须有分歧镜头", "必须有压力镜头", "高潮是问题解决", "结尾必须回归平静"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "natural",
    lightingDirective: "office neutral",
    pacingDirective: "medium",
    dialogueDirective: "realistic",
    musicDirective: "neutral build"
  },
  {
    archetype: "valentines_day",
    directorRules: ["开场必须浪漫细节", "必须有等待情绪", "必须有靠近过程", "高潮是情感表达", "结尾必须温柔留白"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "slow",
    lightingDirective: "warm romantic",
    pacingDirective: "slow",
    dialogueDirective: "soft",
    musicDirective: "romantic swell"
  },
  {
    archetype: "mothers_day",
    directorRules: ["开场必须日常细节", "必须有回忆触发", "必须有情绪压抑", "高潮是情感释放", "结尾必须留空镜"],
    shotSequence: "scene→face→face→scene→face→scene",
    cameraStyle: "slow",
    lightingDirective: "warm soft",
    pacingDirective: "slow emotional",
    dialogueDirective: "minimal",
    musicDirective: "emotional swell"
  },
  {
    archetype: "fathers_day",
    directorRules: ["开场必须手或工具", "必须有沉默互动", "必须有距离感", "高潮是理解", "结尾必须平静"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "static",
    lightingDirective: "neutral warm",
    pacingDirective: "slow",
    dialogueDirective: "minimal",
    musicDirective: "subtle"
  },
  {
    archetype: "christmas",
    directorRules: ["开场必须灯光细节", "必须有装饰镜头", "必须有互动", "高潮是礼物或笑声", "结尾必须温暖定格"],
    shotSequence: "scene→scene→face→scene→scene→scene",
    cameraStyle: "smooth",
    lightingDirective: "warm festive",
    pacingDirective: "medium",
    dialogueDirective: "light",
    musicDirective: "festive"
  },
  {
    archetype: "secret_revealed",
    directorRules: ["开场必须隐藏信息", "必须有暗示镜头", "必须延迟揭示", "高潮是震惊", "结尾必须余波"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "tight",
    lightingDirective: "low key",
    pacingDirective: "build suspense",
    dialogueDirective: "short",
    musicDirective: "tension peak"
  },
  {
    archetype: "unexpected_reunion",
    directorRules: ["开场必须人群或环境", "必须有识别瞬间", "必须有停顿", "高潮是靠近或拥抱", "结尾必须延长停留"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "slow push",
    lightingDirective: "soft warm",
    pacingDirective: "slow emotional",
    dialogueDirective: "broken phrases",
    musicDirective: "emotional swell"
  },
  {
    archetype: "fate_turning",
    directorRules: ["开场必须平静", "必须有预兆", "必须有触发点", "高潮是转折", "结尾必须不稳定"],
    shotSequence: "scene→scene→face→scene→scene→scene",
    cameraStyle: "sharp cuts",
    lightingDirective: "contrast",
    pacingDirective: "sudden shift",
    dialogueDirective: "minimal",
    musicDirective: "dramatic hit"
  },
  {
    archetype: "longing_distance",
    directorRules: ["开场必须空镜", "必须有独处", "必须有思念触发", "高潮是情绪爆发", "结尾必须静止"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "slow static",
    lightingDirective: "low soft",
    pacingDirective: "slow",
    dialogueDirective: "minimal",
    musicDirective: "soft emotional"
  },
  {
    archetype: "self_discovery",
    directorRules: ["开场必须迷茫状态", "必须有探索镜头", "必须有冲突", "高潮是顿悟", "结尾必须稳定"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "introspective",
    lightingDirective: "soft contrast",
    pacingDirective: "medium",
    dialogueDirective: "minimal",
    musicDirective: "introspective"
  },
  {
    archetype: "letting_go",
    directorRules: ["开场必须执念物件", "必须有回忆", "必须有犹豫", "高潮是放手", "结尾必须空"],
    shotSequence: "scene→face→face→scene→scene→scene",
    cameraStyle: "slow",
    lightingDirective: "soft",
    pacingDirective: "slow release",
    dialogueDirective: "minimal",
    musicDirective: "fade out"
  },
  {
    archetype: "war_sacrifice",
    directorRules: ["开场必须混乱", "必须有危险", "必须有选择", "高潮是牺牲", "结尾必须静止"],
    shotSequence: "scene→face→scene→scene→scene→scene",
    cameraStyle: "shaky",
    lightingDirective: "desaturated",
    pacingDirective: "fast then stop",
    dialogueDirective: "minimal",
    musicDirective: "epic tragic"
  },
  {
    archetype: "street_fight",
    directorRules: ["开场必须对峙", "必须有挑衅", "必须突然爆发", "高潮是打击", "结尾必须离场"],
    shotSequence: "scene→face→scene→scene→scene→scene",
    cameraStyle: "handheld",
    lightingDirective: "gritty",
    pacingDirective: "very fast",
    dialogueDirective: "short",
    musicDirective: "aggressive"
  },
  {
    archetype: "hero_moment",
    directorRules: ["开场必须危机", "必须有绝望", "必须延迟英雄", "高潮是出现", "结尾必须定格"],
    shotSequence: "scene→face→scene→scene→scene→scene",
    cameraStyle: "dramatic",
    lightingDirective: "high contrast",
    pacingDirective: "build then explode",
    dialogueDirective: "minimal",
    musicDirective: "epic"
  },
  {
    archetype: "chase_escape",
    directorRules: ["开场必须触发", "必须持续运动", "必须有危险接近", "高潮是逃脱", "结尾必须喘息"],
    shotSequence: "scene→face→scene→scene→scene→scene",
    cameraStyle: "tracking",
    lightingDirective: "dynamic",
    pacingDirective: "very fast",
    dialogueDirective: "none",
    musicDirective: "fast tension"
  },
  {
    archetype: "relatable_micro_drama",
    directorRules: ["开场必须是日常细节", "必须快速进入冲突（第2镜）", "必须有沉默停顿", "高潮是情绪爆点或一句话", "结尾必须留未说完的感觉"],
    shotSequence: "scene→face→face→face→scene→scene",
    cameraStyle: "tight close-up",
    lightingDirective: "natural neutral",
    pacingDirective: "fast emotional spike",
    dialogueDirective: "max 8 words",
    musicDirective: "subtle then drop"
  }
]

export function getDirectorRules(archetype: string) {
  return DIRECTOR_RULES.find(r => r.archetype === archetype) || null
}
