// AI-GENERATED: director-v2.ts
// Purpose: Improved shot selection logic driven by emotion mapping.
// Produces a valid ExecutionPlan with 6 shots following the hook→build→peak→release→ending arc.
// DO NOT modify existing director.ts — this is a standalone improvement module.

// ─── Interfaces (compatible with existing ExecutionPlan) ──────────────────────

interface Shot {
  type: 'face' | 'scene'
  emotion: string          // playable physical state (visible behavior, not abstract label)
  duration: number
  intensity: number        // 1-10 scale
  purpose: 'hook' | 'build' | 'peak' | 'release' | 'ending'
}

interface ExecutionPlan {
  shots: Shot[]
}

// ─── Emotion → Category Mapping ───────────────────────────────────────────────

type EmotionCategory = 'high_tension' | 'grief' | 'love' | 'playful' | 'epic' | 'neutral'

const EMOTION_CATEGORY_MAP: Record<string, EmotionCategory> = {
  panic: 'high_tension',
  fear: 'high_tension',
  terror: 'high_tension',
  suspense: 'high_tension',
  betrayal: 'high_tension',
  confrontation: 'high_tension',
  anger: 'high_tension',
  grief: 'grief',
  sadness: 'grief',
  longing: 'grief',
  regret: 'grief',
  melancholy: 'grief',
  bittersweet: 'grief',
  love: 'love',
  romance: 'love',
  tenderness: 'love',
  warmth: 'love',
  nostalgia: 'love',
  playful: 'playful',
  funny: 'playful',
  joy: 'playful',
  excitement: 'playful',
  epic: 'epic',
  triumph: 'epic',
  power: 'epic',
  determination: 'epic',
  comeback: 'epic',
  neutral: 'neutral',
  calm: 'neutral',
  reflective: 'neutral',
}

function categorizeEmotion(emotion: string): EmotionCategory {
  const normalized = emotion.toLowerCase().trim()
  return EMOTION_CATEGORY_MAP[normalized] ?? 'neutral'
}

// ─── Intensity Curves per Category ───────────────────────────────────────────
// 6 values: hook, build1, build2, peak, release, ending
// Increases until peak (index 3), then drops.

const INTENSITY_CURVES: Record<EmotionCategory, number[]> = {
  high_tension: [4, 6, 7, 10, 5, 2],
  grief:        [3, 5, 6,  9, 4, 2],
  love:         [3, 5, 6,  8, 5, 3],
  playful:      [4, 5, 6,  8, 4, 3],
  epic:         [4, 6, 7, 10, 5, 3],
  neutral:      [3, 4, 6,  8, 4, 2],
}

// ─── Playable State Arcs ──────────────────────────────────────────────────────
// Each entry is a visible physical behavior — not an abstract emotion label.
// Actors and AI can directly render these states.

const PLAYABLE_STATE_ARCS: Record<EmotionCategory, string[]> = {
  high_tension: [
    'eyes scanning the room, shoulders raised',
    'jaw tightening, breath held',
    'hands gripping surface, body frozen',
    'pupils wide, mouth slightly open, body rigid',
    'sudden exhale, hands releasing grip',
    'eyes closing slowly, stillness',
  ],
  grief: [
    'gaze drifting to a distant point, lips pressed together',
    'eyes lowering, breath slowing, hands folded',
    'chin dropping, shoulders curling inward',
    'tears forming, throat visibly tightening',
    'slow exhale, body releasing tension',
    'eyes closing, small nod, quiet stillness',
  ],
  love: [
    'soft smile forming, eyes warming',
    'leaning slightly forward, gaze softening',
    'hand reaching out, breath catching',
    'eyes glistening, full smile, body open',
    'slow blink, exhale, shoulders dropping',
    'quiet gaze, gentle stillness, lips relaxed',
  ],
  playful: [
    'eyebrows raising, corner of mouth twitching',
    'suppressed grin, eyes darting sideways',
    'sudden movement, body leaning in',
    'full laugh breaking out, head tilting back',
    'catching breath, wiping eye, grinning',
    'relaxed smile, slow head shake',
  ],
  epic: [
    'head down, fists clenched at sides',
    'jaw set, eyes narrowing with focus',
    'body straightening, chin lifting',
    'eyes blazing, chest expanding, voice rising',
    'standing tall, breathing hard, surveying',
    'slow turn, calm gaze, weight settling',
  ],
  neutral: [
    'still posture, eyes unfocused, breathing steady',
    'slow head turn, gaze settling on something',
    'slight frown forming, eyes sharpening',
    'body leaning forward, expression opening',
    'long exhale, shoulders dropping',
    'eyes closing briefly, quiet nod',
  ],
}

// ─── Dynamic Arc Builder ──────────────────────────────────────────────────────

function buildDynamicEmotionArc(primaryEmotion: string): { state: string; intensity: number }[] {
  const category = categorizeEmotion(primaryEmotion)
  const states = PLAYABLE_STATE_ARCS[category]
  const intensities = INTENSITY_CURVES[category]

  return states.map((state, i) => ({
    state,
    intensity: intensities[i],
  }))
}

// ─── Shot Type Rules ──────────────────────────────────────────────────────────
// Intensity-first: high → face, low → scene. Mid-range: context-based.

function getShotType(
  intensity: number,
  category: EmotionCategory,
  purpose: 'hook' | 'build' | 'peak' | 'release' | 'ending'
): 'face' | 'scene' {
  if (intensity >= 8) return 'face'
  if (intensity <= 3) return 'scene'

  if (purpose === 'hook') {
    return category === 'high_tension' || category === 'grief' ? 'face' : 'scene'
  }
  if (purpose === 'build') {
    return category === 'playful' || category === 'epic' ? 'scene' : 'face'
  }
  if (purpose === 'peak') return 'face'
  if (purpose === 'release') return 'scene'
  if (purpose === 'ending') {
    return category === 'high_tension' || category === 'epic' ? 'scene' : 'face'
  }
  return 'scene'
}

// ─── Duration Rules ───────────────────────────────────────────────────────────

function getShotDuration(
  category: EmotionCategory,
  purpose: 'hook' | 'build' | 'peak' | 'release' | 'ending'
): number {
  const durationMap: Record<EmotionCategory, Record<string, number>> = {
    high_tension: { hook: 3, build: 4, peak: 5, release: 4, ending: 4 },
    grief:        { hook: 4, build: 5, peak: 6, release: 5, ending: 6 },
    love:         { hook: 4, build: 5, peak: 6, release: 5, ending: 7 },
    playful:      { hook: 3, build: 3, peak: 4, release: 4, ending: 4 },
    epic:         { hook: 4, build: 5, peak: 7, release: 5, ending: 6 },
    neutral:      { hook: 4, build: 5, peak: 6, release: 5, ending: 5 },
  }
  return durationMap[category][purpose] ?? 5
}

// ─── Main Director V2 Function ────────────────────────────────────────────────

/**
 * buildExecutionPlan
 *
 * Given a primary emotion string, returns a valid ExecutionPlan with 6 shots
 * following the arc: hook → build → build → peak → release → ending.
 *
 * Each shot has:
 * - emotion: a visible playable physical state (not an abstract label)
 * - purpose: the narrative role of the shot
 * - intensity: 1-10, increases until peak then drops
 * - type: face or scene, driven by intensity then context
 * - duration: paced by emotion category and purpose
 */
export function buildExecutionPlan(primaryEmotion: string): ExecutionPlan {
  const category = categorizeEmotion(primaryEmotion)
  const arc = buildDynamicEmotionArc(primaryEmotion)

  const purposes: Array<'hook' | 'build' | 'peak' | 'release' | 'ending'> = [
    'hook', 'build', 'build', 'peak', 'release', 'ending'
  ]

  const shots: Shot[] = purposes.map((purpose, index) => {
    const { state, intensity } = arc[index]
    return {
      type: getShotType(intensity, category, purpose),
      emotion: state,
      duration: getShotDuration(category, purpose),
      intensity,
      purpose,
    }
  })

  return { shots }
}

// ─── Utility: Validate ExecutionPlan ─────────────────────────────────────────

export function validateExecutionPlan(plan: ExecutionPlan): boolean {
  if (!plan || !Array.isArray(plan.shots) || plan.shots.length === 0) return false
  const validPurposes = new Set(['hook', 'build', 'peak', 'release', 'ending'])
  return plan.shots.every(
    s =>
      (s.type === 'face' || s.type === 'scene') &&
      typeof s.emotion === 'string' &&
      s.emotion.length > 0 &&
      typeof s.duration === 'number' &&
      s.duration > 0 &&
      typeof s.intensity === 'number' &&
      s.intensity >= 1 &&
      s.intensity <= 10 &&
      validPurposes.has(s.purpose)
  )
}
