// ============ TYPES ============
export type ModuleType = 'camera' | 'performance' | 'audio' | 'lighting' | 'rhythm' | 'narrative'

export interface Proposal {
  id: string
  module: ModuleType
  action: string
  params: Record<string, any>
  emotionAlignment: number
  tensionScore: number
  novelty: number
  cost: number
  weight?: number
}

export interface DecisionContext {
  targetEmotion: 'grief' | 'tension' | 'desire' | 'release'
  phase: 'build' | 'peak' | 'release'
  intensity: number
}

export interface PerformanceFrame {
  t: number
  emotion: 'suppressed' | 'release' | 'tension' | 'neutral'
  micro: 'eye_shift' | 'blink_slow' | 'jaw_clench' | 'lip_press' | null
  breath: 'hold' | 'shallow' | 'release' | null
  gaze: 'down' | 'lock' | 'avoid' | 'close_eyes'
}

export interface PerformanceTimeline {
  duration: number
  frames: PerformanceFrame[]
}

export interface BlockingPlan {
  zMovement: 'push_in' | 'pull_out' | 'static'
  depth: 'shallow' | 'deep'
  foreground: boolean
  midground: boolean
  background: boolean
}

export interface NarrativeLayer {
  viewerKnows: boolean
  characterKnows: boolean
  revealAt: number
}

export interface NarrativeControl {
  layers: NarrativeLayer[]
}

// ============ SCORING ============
export function scoreProposal(p: Proposal, ctx: DecisionContext): number {
  const base =
    p.emotionAlignment * 0.4 +
    p.tensionScore * 0.3 +
    p.novelty * 0.2 -
    p.cost * 0.2

  if (ctx.phase === 'peak' && p.tensionScore > 0.7) return base + 0.2
  if (ctx.phase === 'release' && p.action.includes('slow')) return base + 0.15
  return base
}

// ============ CONFLICT RESOLUTION ============
export function resolveConflicts(proposals: Proposal[]): Proposal[] {
  const conflictPairs: [string, string][] = [
    ['fast_cut', 'slow_push'],
    ['tear_release', 'emotion_suppression'],
    ['loud_bgm', 'silence']
  ]
  return proposals.filter(p => {
    for (const [a, b] of conflictPairs) {
      if (
        (p.action.includes(a) && proposals.some(x => x.action.includes(b))) ||
        (p.action.includes(b) && proposals.some(x => x.action.includes(a)))
      ) return false
    }
    return true
  })
}

// ============ DECISION ENGINE ============
export function selectBest(proposals: Proposal[], ctx: DecisionContext): Proposal[] {
  const filtered = resolveConflicts(proposals)
  const scored = filtered.map(p => ({ ...p, weight: scoreProposal(p, ctx) }))
  scored.sort((a, b) => (b.weight! - a.weight!))
  const selected: Record<string, Proposal> = {}
  for (const p of scored) {
    if (!selected[p.module]) selected[p.module] = p
  }
  return Object.values(selected)
}

export function directorBrain(proposals: Proposal[], ctx: DecisionContext) {
  const selected = selectBest(proposals, ctx)
  return {
    camera: selected.find(p => p.module === 'camera'),
    performance: selected.find(p => p.module === 'performance'),
    audio: selected.find(p => p.module === 'audio'),
    lighting: selected.find(p => p.module === 'lighting'),
    rhythm: selected.find(p => p.module === 'rhythm'),
    narrative: selected.find(p => p.module === 'narrative')
  }
}

// ============ PROMPT INJECTION ============
export function injectPerformance(prompt: string, perf: PerformanceTimeline): string {
  const perfStr = perf.frames.map(f =>
    `[t=${f.t}s emotion=${f.emotion} micro=${f.micro} breath=${f.breath} gaze=${f.gaze}]`
  ).join(' ')
  return `${prompt}\nActor performance timeline:\n${perfStr}\nActing style: subtle, restrained, micro-expression driven, cinematic realism.`
}

export function injectBlocking(prompt: string, block: BlockingPlan): string {
  return `${prompt}\nCinematic blocking:\n- camera movement: ${block.zMovement}\n- depth of field: ${block.depth}\n- layers: foreground=${block.foreground}, midground=${block.midground}, background=${block.background}\nUse strong depth composition, subject separation, cinematic parallax.`
}

export function applyNarrative(prompt: string, n: NarrativeControl): string {
  const layerStr = n.layers.map(l =>
    `[revealAt=${l.revealAt}s viewer=${l.viewerKnows} character=${l.characterKnows}]`
  ).join(' ')
  return `${prompt}\nNarrative reveal control:\n${layerStr}\nMaintain suspense. Delay key information until reveal points.`
}

export function buildKlingPrompt(
  base: string,
  perf: PerformanceTimeline,
  block: BlockingPlan,
  narrative: NarrativeControl
): string {
  let p = base
  p = injectPerformance(p, perf)
  p = injectBlocking(p, block)
  p = applyNarrative(p, narrative)
  return p
}

export function buildFinalPrompt(base: string, decision: ReturnType<typeof directorBrain>): string {
  return `
${base}

Camera: ${decision.camera?.action}
Performance: ${JSON.stringify(decision.performance?.params)}
Audio: ${decision.audio?.action}
Lighting: ${decision.lighting?.action}
Narrative: ${decision.narrative?.action}

Style: cinematic, restrained, emotional realism, shallow depth of field
`.trim()
}
