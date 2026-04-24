/**
 * Director Brain v2
 * Performance / Blocking / Narrative / Audio systems
 * Master function: buildKlingPrompt
 */

// ═══════════════════════════════════════════════════════════════
// 1. PERFORMANCE ENGINE
// ═══════════════════════════════════════════════════════════════

export interface PerformanceFrame {
  /** Shot number this frame applies to */
  shotNumber: number
  /** Micro-expression instruction for the actor */
  microExpression: string
  /** Body language cue */
  bodyLanguage: string
  /** Eye direction */
  eyeDirection: 'camera' | 'off-camera-left' | 'off-camera-right' | 'down' | 'up'
  /** Breath rhythm: slow = calm, fast = tension */
  breathRhythm: 'slow' | 'normal' | 'fast' | 'held'
  /** Emotional subtext the actor should hold internally */
  internalState: string
}

export interface PerformanceTimeline {
  frames: PerformanceFrame[]
  /** Overall performance arc */
  arc: 'restrained' | 'building' | 'explosive' | 'collapsing' | 'transcendent'
}

/**
 * Inject performance instructions into a Kling prompt string.
 * Appends micro-expression and body language cues.
 */
export function injectPerformance(basePrompt: string, frame: PerformanceFrame): string {
  const performanceCue = [
    `micro-expression: ${frame.microExpression}`,
    `body: ${frame.bodyLanguage}`,
    `eyes: ${frame.eyeDirection}`,
    `breath: ${frame.breathRhythm}`,
    `internal: ${frame.internalState}`,
  ].join(', ')
  return `${basePrompt}, [PERFORMANCE: ${performanceCue}]`
}

// ═══════════════════════════════════════════════════════════════
// 2. EDIT PLAN
// ═══════════════════════════════════════════════════════════════

export interface EditSegment {
  shotNumber: number
  /** Cut type at the END of this shot */
  cutType: 'hard-cut' | 'dissolve' | 'fade-to-black' | 'match-cut' | 'j-cut' | 'l-cut' | 'smash-cut'
  /** Duration of transition in seconds */
  transitionDuration: number
  /** Pacing note for this segment */
  pacingNote: string
}

export interface EditPlan {
  segments: EditSegment[]
  /** Overall rhythm */
  rhythm: 'staccato' | 'legato' | 'accelerating' | 'decelerating' | 'irregular'
  /** Total edit count */
  totalCuts: number
}

// ═══════════════════════════════════════════════════════════════
// 3. BLOCKING PLAN
// ═══════════════════════════════════════════════════════════════

export interface BlockingPlan {
  /** Shot number */
  shotNumber: number
  /** Where the subject is positioned in frame */
  subjectPosition: 'center' | 'left-third' | 'right-third' | 'foreground' | 'background' | 'off-frame'
  /** Movement vector */
  movement: 'static' | 'toward-camera' | 'away-from-camera' | 'lateral-left' | 'lateral-right' | 'diagonal'
  /** Depth of field instruction */
  depthOfField: 'shallow' | 'medium' | 'deep'
  /** Foreground element (optional) */
  foregroundElement?: string
  /** Background element (optional) */
  backgroundElement?: string
}

/**
 * Inject blocking instructions into a Kling prompt string.
 */
export function injectBlocking(basePrompt: string, blocking: BlockingPlan): string {
  const blockingCue = [
    `position: ${blocking.subjectPosition}`,
    `movement: ${blocking.movement}`,
    `DOF: ${blocking.depthOfField}`,
    blocking.foregroundElement ? `FG: ${blocking.foregroundElement}` : null,
    blocking.backgroundElement ? `BG: ${blocking.backgroundElement}` : null,
  ].filter(Boolean).join(', ')
  return `${basePrompt}, [BLOCKING: ${blockingCue}]`
}

// ═══════════════════════════════════════════════════════════════
// 4. NARRATIVE CONTROL
// ═══════════════════════════════════════════════════════════════

export interface NarrativeLayer {
  /** Shot number */
  shotNumber: number
  /** What this shot SHOWS (surface) */
  surface: string
  /** What this shot MEANS (subtext) */
  subtext: string
  /** Narrative function */
  function: 'hook' | 'setup' | 'complication' | 'escalation' | 'peak' | 'reversal' | 'resolution' | 'breath'
  /** Tension level 1-10 */
  tension: number
}

export interface NarrativeControl {
  layers: NarrativeLayer[]
  /** Story structure type */
  structure: 'three-act' | 'in-medias-res' | 'circular' | 'revelation' | 'contrast'
  /** Emotional throughline */
  throughline: string
}

/**
 * Apply narrative context to a Kling prompt string.
 */
export function applyNarrative(basePrompt: string, layer: NarrativeLayer): string {
  return `${basePrompt}, [NARRATIVE: function=${layer.function} tension=${layer.tension}/10 subtext="${layer.subtext}"]`
}

// ═══════════════════════════════════════════════════════════════
// 5. AUDIO PLAN
// ═══════════════════════════════════════════════════════════════

export interface AudioLayer {
  shotNumber: number
  /** Music state for this shot */
  musicState: 'off' | 'low' | 'medium' | 'high' | 'crescendo' | 'fade-out' | 'silence'
  /** Ambient sound description */
  ambientSound: string
  /** Whether dialogue is present */
  hasDialogue: boolean
  /** J-cut: next shot's audio starts here */
  jCut?: string
  /** L-cut: this shot's audio continues into next */
  lCut?: string
}

export interface AudioPlan {
  layers: AudioLayer[]
  /** Overall music genre/mood */
  musicMood: string
  /** BPM range */
  bpmRange: string
}

// ═══════════════════════════════════════════════════════════════
// 6. MASTER FUNCTION: buildKlingPrompt
// ═══════════════════════════════════════════════════════════════

export interface KlingPromptOptions {
  /** Shot number to build prompt for */
  shotNumber: number
  /** Base Kling template string */
  base: string
  /** Full performance timeline */
  performanceTimeline?: PerformanceTimeline
  /** Array of blocking plans (one per shot) */
  blockingPlans?: BlockingPlan[]
  /** Narrative control object */
  narrativeControl?: NarrativeControl
}

/**
 * Master function: combines base template with performance,
 * blocking, and narrative layers into a final Kling prompt.
 *
 * @param base - Base Kling prompt template string
 * @param performanceTimeline - Optional performance timeline
 * @param blockingPlans - Optional array of blocking plans
 * @param narrativeControl - Optional narrative control
 * @param shotNumber - Which shot to build (1-indexed)
 */
export function buildKlingPrompt(
  base: string,
  performanceTimeline?: PerformanceTimeline,
  blockingPlans?: BlockingPlan[],
  narrativeControl?: NarrativeControl,
  shotNumber = 1
): string {
  let prompt = base

  // Inject performance frame for this shot
  if (performanceTimeline) {
    const frame = performanceTimeline.frames.find(f => f.shotNumber === shotNumber)
    if (frame) {
      prompt = injectPerformance(prompt, frame)
    }
  }

  // Inject blocking for this shot
  if (blockingPlans) {
    const blocking = blockingPlans.find(b => b.shotNumber === shotNumber)
    if (blocking) {
      prompt = injectBlocking(prompt, blocking)
    }
  }

  // Apply narrative layer for this shot
  if (narrativeControl) {
    const layer = narrativeControl.layers.find(l => l.shotNumber === shotNumber)
    if (layer) {
      prompt = applyNarrative(prompt, layer)
    }
  }

  return prompt
}

// ═══════════════════════════════════════════════════════════════
// FACTORY HELPERS — build default plans from archetype + emotion curve
// ═══════════════════════════════════════════════════════════════

type EmotionCurveShot = { shot: number; emotion: string; intensity: number; type: string }

/**
 * Build a default PerformanceTimeline from an emotion curve.
 */
export function buildPerformanceTimeline(
  emotionCurve: EmotionCurveShot[]
): PerformanceTimeline {
  const frames: PerformanceFrame[] = emotionCurve.map(s => ({
    shotNumber: s.shot,
    microExpression: s.intensity >= 8
      ? 'jaw slightly tense, eyes glistening'
      : s.intensity >= 5
      ? 'subtle lip compression, brow slightly furrowed'
      : 'neutral with soft eyes, slight upward lip corner',
    bodyLanguage: s.type === 'face'
      ? s.intensity >= 7 ? 'shoulders drawn in, chest tight' : 'relaxed shoulders, open chest'
      : 'implied through environment',
    eyeDirection: s.shot === 1 ? 'camera' : s.intensity >= 7 ? 'down' : 'off-camera-left',
    breathRhythm: s.intensity >= 8 ? 'held' : s.intensity >= 5 ? 'slow' : 'normal',
    internalState: s.emotion,
  }))

  const maxIntensity = Math.max(...emotionCurve.map(s => s.intensity))
  const arc: PerformanceTimeline['arc'] =
    maxIntensity >= 9 ? 'explosive'
    : maxIntensity >= 7 ? 'building'
    : maxIntensity >= 5 ? 'restrained'
    : 'transcendent'

  return { frames, arc }
}

/**
 * Build a default NarrativeControl from archetype and emotion curve.
 */
export function buildNarrativeControl(
  archetype: string,
  emotionCurve: EmotionCurveShot[],
  throughline = ''
): NarrativeControl {
  const functionMap: NarrativeLayer['function'][] = [
    'hook', 'setup', 'complication', 'escalation', 'peak', 'reversal', 'resolution', 'breath'
  ]

  const layers: NarrativeLayer[] = emotionCurve.map((s, i) => ({
    shotNumber: s.shot,
    surface: `Shot ${s.shot}: ${s.emotion}`,
    subtext: `underlying ${archetype} tension`,
    function: functionMap[Math.min(i, functionMap.length - 1)],
    tension: s.intensity,
  }))

  return {
    layers,
    structure: 'in-medias-res',
    throughline: throughline || archetype,
  }
}

/**
 * Build a default BlockingPlan array from emotion curve.
 */
export function buildBlockingPlans(emotionCurve: EmotionCurveShot[]): BlockingPlan[] {
  return emotionCurve.map(s => ({
    shotNumber: s.shot,
    subjectPosition: s.intensity >= 8 ? 'center' : s.shot % 2 === 0 ? 'left-third' : 'right-third',
    movement: s.intensity >= 7 ? 'toward-camera' : 'static',
    depthOfField: s.type === 'face' ? 'shallow' : 'medium',
  }))
}
