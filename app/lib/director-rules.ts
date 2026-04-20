export const DIRECTOR_RULES = [
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
  }
]

export function getDirectorRules(archetype: string) {
  return DIRECTOR_RULES.find(r => r.archetype === archetype) || null
}
