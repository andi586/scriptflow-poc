export interface UserSignal {
  watchTime: number
  completionRate: number
  rewatch: boolean
  pauseCount: number
  share: boolean
  clickThrough: boolean
}

export interface GrowthScore {
  hookScore: number
  retentionScore: number
  emotionalImpact: number
  viralScore: number
}

export function scoreVideo(signal: UserSignal): GrowthScore {
  return {
    hookScore: signal.watchTime > 3 ? 1 : 0.3,
    retentionScore: signal.completionRate,
    emotionalImpact: signal.rewatch ? 0.9 : 0.4,
    viralScore: signal.share ? 1 : 0.2
  }
}

export const HOOKS = [
  "We almost did something we couldn't undo.",
  "That night… we crossed a line. Almost.",
  "I shouldn't be telling you this.",
  "We both knew it was wrong.",
  "This is the moment everything changed.",
  "I only had 60 seconds left.",
  "I trusted the wrong person.",
  "Something wasn't here before."
]

export const CTA = [
  "Would you have done the same?",
  "Tell me what you think happened next.",
  "Tag the person you thought of."
]

export type ViralTrigger = 'relatable' | 'regret' | 'forbidden' | 'almost'

export interface RetentionPlan {
  spikes: number[]
}

export function buildRetention(duration: number): RetentionPlan {
  return { spikes: [1.5, duration * 0.5, duration * 0.8] }
}

export function injectHook(script: string): string {
  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)]
  return `${hook}\n${script}`
}

export function injectRetention(prompt: string, plan: RetentionPlan): string {
  const spikes = plan.spikes.map(s => `intensity spike at ${s}s`).join(', ')
  return `${prompt}\n\nEmotional pacing:\n${spikes}\n\nEnsure tension rises sharply at these timestamps.`
}

export function pickTrigger(): ViralTrigger {
  const triggers: ViralTrigger[] = ['relatable', 'regret', 'forbidden', 'almost']
  return triggers[Math.floor(Math.random() * triggers.length)]
}

export function injectViral(prompt: string, trigger: ViralTrigger): string {
  return `${prompt}\n\nNarrative tone: ${trigger}\nFocus on emotional relatability and shareability.`
}

export function buildGrowthPrompt(base: string): string {
  let p = base
  p = injectHook(p)
  const retention = buildRetention(8)
  p = injectRetention(p, retention)
  const trigger = pickTrigger()
  p = injectViral(p, trigger)
  return p
}

export interface Variant {
  id: string
  prompt: string
}

export function generateVariants(base: string): Variant[] {
  return Array.from({ length: 3 }).map((_, i) => ({
    id: `v${i}`,
    prompt: buildGrowthPrompt(base)
  }))
}

export function pickWinner(results: { id: string; signal: UserSignal }[]) {
  return results
    .map(r => ({ ...r, score: scoreVideo(r.signal) }))
    .sort((a, b) => b.score.viralScore - a.score.viralScore)[0]
}

export function generateTitle(): string {
  return HOOKS[Math.floor(Math.random() * HOOKS.length)]
}

export function generateColdStartBatch(base: string) {
  return Array.from({ length: 10 }).map(() => ({
    title: generateTitle(),
    prompt: buildGrowthPrompt(base)
  }))
}

export function isWinner(signal: UserSignal): boolean {
  return signal.watchTime > 3 && signal.completionRate > 0.4
}
