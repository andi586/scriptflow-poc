// AI-GENERATED: director-v2.ts
// Purpose: Improved shot selection logic driven by emotion mapping.
// Produces a valid ExecutionPlan with 6 shots following the hook→build→peak→release→ending arc.
// DO NOT modify existing director.ts — this is a standalone improvement module.

// ─── Interfaces (compatible with existing ExecutionPlan) ──────────────────────

interface Shot {
  type: 'face' | 'scene'
  emotion: string
  duration: number
  intensity: number // 1-10 scale
}

interface ExecutionPlan {
  shots: Shot[]
}

// ─── Emotion → Category Mapping ───────────────────────────────────────────────

type EmotionCategory = 'high_tension' | 'grief' | 'love' | 'playful' | 'epic' | 'neutral'

const EMOTION_CATEGORY_MAP: Record<string, EmotionCategory> = {
  // High tension / fear
  panic: 'high_tension',
  fear: 'high_tension',
  terror: 'high_tension',
  suspense: 'high_tension',
  betrayal: 'high_tension',
  confrontation: 'high_tension',
  anger: 'high_tension',
  // Grief / sadness
  grief: 'grief',
  sadness: 'grief',
  longing: 'grief',
  regret: 'grief',
  melancholy: 'grief',
  bittersweet: 'grief',
  // Love / warmth
  love: 'love',
  romance: 'love',
  tenderness: 'love',
  warmth: 'love',
  nostalgia: 'love',
  // Playful / light
  playful: 'playful',
  funny: 'playful',
  joy: 'playful',
  excitement: 'playful',
  // Epic / triumph
  epic: 'epic',
  triumph: 'epic',
  power: 'epic',
  determination: 'epic',
  comeback: 'epic',
  // Default
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
// Must increase until peak (index 3), then drop.

const INTENSITY_CURVES: Record<EmotionCategory, number[]> = {
  high_tension: [4, 6, 7, 10, 5, 2],
  grief:        [3, 5, 6, 9,  4, 2],
  love:         [3, 5, 6, 8,  5, 3],
  playful:      [4, 5, 6, 8,  4, 3],
  epic:         [4, 6, 7, 10, 5, 3],
  neutral:      [3, 4, 6, 8,  4, 2],
}

// ─── Emotion Arc Labels per Category ─────────────────────────────────────────
// Dynamic: each position gets a label derived from the category's narrative arc.

const EMOTION_ARCS: Record<EmotionCategory, string[]> = {
  high_tension: ['unease', 'suspicion', 'dread', 'terror', 'shock', 'silence'],
  grief:        ['memory', 'longing', 'sadness', 'grief', 'release', 'acceptance'],
  love:         ['warmth', 'tenderness', 'longing', 'love', 'joy', 'peace'],
  playful:      ['curiosity', 'mischief', 'chaos', 'laughter', 'relief', 'warmth'],
  epic:         ['struggle', 'determination', 'resistance', 'triumph', 'power', 'legacy'],
  neutral:      ['calm', 'reflection', 'realization', 'emotion', 'release', 'peace'],
}

// ─── Dynamic Emotion Arc Generator ───────────────────────────────────────────
// Returns 6 emotion labels with increasing intensity until peak.

function buildDynamicEmotionArc(primaryEmotion: string): { label: string; intensity: number }[] {
  const category = categorizeEmotion(primaryEmotion)
  const labels = EMOTION_ARCS[category]
  const intensities = INTENSITY_CURVES[category]

  return labels.map((label, i) => ({
    label,
    intensity: intensities[i],
  }))
}

// ─── Shot Type Rules ──────────────────────────────────────────────────────────
// Intensity-first: high intensity → face, low intensity → scene.
// Mid-range: context-based (category + position).

function getShotType(
  intensity: number,
  category: EmotionCategory,
  position: 'hook' | 'build' | 'peak' | 'release' | 'ending'
): 'face' | 'scene' {
  // Intensity-driven rules (override context)
  if (intensity >= 8) return 'face'
  if (intensity <= 3) return 'scene'

  // Context-based for mid-range (4-7)
  if (position === 'hook') {
    return category === 'high_tension' || category === 'grief' ? 'face' : 'scene'
  }
  if (position === 'build') {
    return category === 'playful' || category === 'epic' ? 'scene' : 'face'
  }
  if (position === 'peak') return 'face'
  if (position === 'release') return 'scene'
  if (position === 'ending') {
    return category === 'high_tension' || category === 'epic' ? 'scene' : 'face'
  }
  return 'scene'
}

// ─── Duration Rules ───────────────────────────────────────────────────────────
// Emotion category and position influence pacing.

function getShotDuration(
  category: EmotionCategory,
  position: 'hook' | 'build' | 'peak' | 'release' | 'ending'
): number {
  const durationMap: Record<EmotionCategory, Record<string, number>> = {
    high_tension: { hook: 3, build: 4, peak: 5, release: 4, ending: 4 },
    grief:        { hook: 4, build: 5, peak: 6, release: 5, ending: 6 },
    love:         { hook: 4, build: 5, peak: 6, release: 5, ending: 7 },
    playful:      { hook: 3, build: 3, peak: 4, release: 4, ending: 4 },
    epic:         { hook: 4, build: 5, peak: 7, release: 5, ending: 6 },
    neutral:      { hook: 4, build: 5, peak: 6, release: 5, ending: 5 },
  }
  return durationMap[category][position] ?? 5
}

// ─── Main Director V2 Function ────────────────────────────────────────────────

/**
 * buildExecutionPlan
 *
 * Given a primary emotion string, returns a valid ExecutionPlan with 6 shots
 * following the arc: hook → build → build → peak → release → ending.
 *
 * Shot selection is fully driven by emotion category and dynamic intensity:
 * - intensity increases shot by shot until peak (shot 4), then drops
 * - shot type: intensity >= 8 → face, intensity <= 3 → scene, otherwise context-based
 * - duration depends on emotion category + position
 */
export function buildExecutionPlan(primaryEmotion: string): ExecutionPlan {
  const category = categorizeEmotion(primaryEmotion)
  const arc = buildDynamicEmotionArc(primaryEmotion)

  const positions: Array<'hook' | 'build' | 'peak' | 'release' | 'ending'> = [
    'hook', 'build', 'build', 'peak', 'release', 'ending'
  ]

  const shots: Shot[] = positions.map((position, index) => {
    const { label, intensity } = arc[index]
    return {
      type: getShotType(intensity, category, position),
      emotion: label,
      duration: getShotDuration(category, position),
      intensity,
    }
  })

  return { shots }
}

// ─── Utility: Validate ExecutionPlan ─────────────────────────────────────────

export function validateExecutionPlan(plan: ExecutionPlan): boolean {
  if (!plan || !Array.isArray(plan.shots) || plan.shots.length === 0) return false
  return plan.shots.every(
    s =>
      (s.type === 'face' || s.type === 'scene') &&
      typeof s.emotion === 'string' &&
      typeof s.duration === 'number' &&
      s.duration > 0 &&
      typeof s.intensity === 'number' &&
      s.intensity >= 1 &&
      s.intensity <= 10
  )
}
