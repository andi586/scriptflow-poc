export type HookTemplateID =
  | "T1_FINAL_24_HOURS"
  | "T2_BETRAYAL"
  | "T3_WATCHING"
  | "T4_IDENTITY"
  | "T5_REVENGE_RISE"
  | "T6_PET_SAVE"
  | "T7_FUTURE_CALL"
  | "T8_EVERYONE_KNOWS"
  | "T9_ALREADY_DIED"
  | "T10_YOUR_CHOICE"

type EmotionScore = {
  fear: number
  identity: number
  anger: number
  mystery: number
  power: number
  warmth: number
}

const KEYWORDS = {
  fear: ["die","death","dead","kill","time left","last day","countdown","end","danger","escape","trapped","60秒","死","倒计时","危险"],
  identity: ["who am i","not me","someone else","fake","memory","lost myself","identity","changed","不是我","另一个","平行"],
  anger: ["betray","cheat","lied","left me","stole","hurt me","revenge","hate","背叛","出轨","骗我","复仇"],
  mystery: ["strange","weird","something","unknown","watching","followed","secret","shadow","诡异","跟踪","秘密","奇怪"],
  power: ["rich","power","success","win","prove","rise","comeback","strong","逆袭","成功","赢","崛起"],
  warmth: ["dog","cat","pet","love","family","friend","save","help","猫","狗","宠物","家人","朋友"]
}

function scoreEmotion(input: string): EmotionScore {
  const text = input.toLowerCase()
  const score: EmotionScore = { fear:0, identity:0, anger:0, mystery:0, power:0, warmth:0 }
  for (const key in KEYWORDS) {
    const k = key as keyof EmotionScore
    for (const word of KEYWORDS[k]) {
      if (text.includes(word)) score[k] += 1
    }
  }
  return score
}

function semanticTriggers(input: string): Partial<EmotionScore> {
  const t = input.toLowerCase()
  const out: Partial<EmotionScore> = {}
  if (t.includes("i woke up") || t.includes("suddenly") || t.includes("突然")) out.mystery = 2
  if (t.includes("no one remembers me") || t.includes("没人认识我")) out.identity = 3
  if (t.includes("i have one day") || t.includes("60秒") || t.includes("还有")) out.fear = 3
  if (t.includes("my dog saved") || t.includes("my cat saved") || t.includes("救了我")) out.warmth = 3
  if (t.includes("not my life") || t.includes("不是我的生活")) out.identity = 3
  return out
}

export function selectHookTemplate(input: string): HookTemplateID {
  const base = scoreEmotion(input)
  const extra = semanticTriggers(input)
  for (const k in extra) {
    base[k as keyof EmotionScore] += extra[k as keyof EmotionScore]!
  }

  if (base.fear >= 2) return "T1_FINAL_24_HOURS"
  if (base.identity >= 2) return "T4_IDENTITY"
  if (base.anger >= 2) return "T2_BETRAYAL"
  if (base.mystery >= 2) return "T3_WATCHING"
  if (base.power >= 2) return "T5_REVENGE_RISE"
  if (base.warmth >= 2) return "T6_PET_SAVE"

  // fallback: most converting
  return "T1_FINAL_24_HOURS"
}
