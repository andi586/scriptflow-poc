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
  phase: 'setup' | 'build' | 'tension' | 'peak' | 'release'
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

// ============ SHOT SYSTEM ============

export type ShotPhase = 'setup' | 'build' | 'tension' | 'peak' | 'release'

export interface ShotState {
  shotId: string
  phase: ShotPhase
  duration: number
  intensity: number
  emotion: 'grief' | 'desire' | 'tension' | 'release'
}

export interface AudioLayer {
  type: 'bgm' | 'ambient' | 'silence' | 'subjective'
  start: number
  end: number
  volume: number
}

export interface AudioPlan {
  layers: AudioLayer[]
}

export interface ShotPlan {
  id: string
  state: ShotState
  performance: PerformanceTimeline
  blocking: BlockingPlan
  narrative: NarrativeControl
  audio: AudioPlan
  decisions: ReturnType<typeof directorBrain>
  prompt: string
}

export function buildShotStates(totalShots: number): ShotState[] {
  const phases: ShotPhase[] = ['setup','build','tension','peak','release']
  return Array.from({ length: totalShots }).map((_, i) => {
    const ratio = i / totalShots
    let phase: ShotPhase = 'setup'
    if (ratio > 0.2) phase = 'build'
    if (ratio > 0.5) phase = 'tension'
    if (ratio > 0.75) phase = 'peak'
    if (ratio > 0.9) phase = 'release'
    return {
      shotId: `shot_${i}`,
      phase,
      duration: 2 + Math.random() * 2,
      intensity: ratio,
      emotion: 'tension'
    }
  })
}

export function generatePerformance(state: ShotState): PerformanceTimeline {
  if (state.phase === 'tension') {
    return {
      duration: state.duration,
      frames: [
        { t: 0, emotion: 'suppressed', micro: 'eye_shift', breath: 'hold', gaze: 'avoid' },
        { t: 1.2, emotion: 'tension', micro: 'jaw_clench', breath: 'shallow', gaze: 'lock' }
      ]
    }
  }
  if (state.phase === 'peak') {
    return {
      duration: state.duration,
      frames: [
        { t: 0, emotion: 'tension', micro: 'blink_slow', breath: 'hold', gaze: 'lock' },
        { t: 1.0, emotion: 'release', micro: 'lip_press', breath: 'release', gaze: 'close_eyes' }
      ]
    }
  }
  return {
    duration: state.duration,
    frames: [{ t: 0, emotion: 'neutral', micro: null, breath: null, gaze: 'down' }]
  }
}

export function generateBlocking(state: ShotState): BlockingPlan {
  if (state.phase === 'tension') {
    return { zMovement: 'push_in', depth: 'shallow', foreground: false, midground: true, background: true }
  }
  if (state.phase === 'release') {
    return { zMovement: 'pull_out', depth: 'deep', foreground: true, midground: true, background: true }
  }
  return { zMovement: 'static', depth: 'shallow', foreground: false, midground: true, background: false }
}

export function generateNarrative(state: ShotState): NarrativeControl {
  if (state.phase === 'setup') {
    return { layers: [{ viewerKnows: false, characterKnows: true, revealAt: 0 }] }
  }
  if (state.phase === 'peak') {
    return { layers: [
      { viewerKnows: false, characterKnows: true, revealAt: 0 },
      { viewerKnows: true, characterKnows: false, revealAt: 1.5 }
    ]}
  }
  return { layers: [{ viewerKnows: true, characterKnows: true, revealAt: 0 }] }
}

export function generateAudio(state: ShotState): AudioPlan {
  if (state.phase === 'tension') {
    return { layers: [{ type: 'silence', start: 0, end: state.duration, volume: 1 }] }
  }
  if (state.phase === 'peak') {
    return { layers: [{ type: 'ambient', start: 0, end: state.duration, volume: 0.1 }] }
  }
  return { layers: [{ type: 'bgm', start: 0, end: state.duration, volume: 0.2 }] }
}

export function buildProposals(state: ShotState): Proposal[] {
  return [
    {
      id: 'cam_push', module: 'camera', action: 'slow_push', params: {},
      emotionAlignment: 0.9, tensionScore: 0.8, novelty: 0.5, cost: 0.2
    },
    {
      id: 'perf_suppress', module: 'performance', action: 'emotion_suppression', params: {},
      emotionAlignment: 0.95, tensionScore: 0.9, novelty: 0.6, cost: 0.3
    }
  ]
}

export async function runShotPipeline(story: string, totalShots: number = 6) {
  const states = buildShotStates(totalShots)
  const shots: ShotPlan[] = []

  for (const state of states) {
    const performance = generatePerformance(state)
    const blocking = generateBlocking(state)
    const narrative = generateNarrative(state)
    const audio = generateAudio(state)
    const proposals = buildProposals(state)
    const decisions = directorBrain(proposals, {
      targetEmotion: state.emotion,
      phase: state.phase,
      intensity: state.intensity
    })
    const prompt = buildKlingPrompt(story, performance, blocking, narrative)
    shots.push({ id: state.shotId, state, performance, blocking, narrative, audio, decisions, prompt })
  }

  return shots
}
