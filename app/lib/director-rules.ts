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
  }
]

export function getDirectorRules(archetype: string) {
  return DIRECTOR_RULES.find(r => r.archetype === archetype) || null
}
