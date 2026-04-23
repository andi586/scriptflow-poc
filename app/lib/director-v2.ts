// AI-GENERATED: director-v2.ts
// Purpose: Improved shot selection logic driven by emotion mapping.
// Produces a valid ExecutionPlan with 6 shots following the hook→build→peak→release→ending arc.
// DO NOT modify existing director.ts — this is a standalone improvement module.

// ─── Interfaces (compatible with existing ExecutionPlan) ──────────────────────

interface Shot {
  type: 'face' | 'scene'
  emotion: string
  duration: number
}

interface ExecutionPlan {
  shots: Shot[]
}

// ─── Emotion → Shot Mapping ───────────────────────────────────────────────────

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

// ─── Shot Type Rules ──────────────────────────────────────────────────────────
// Determines whether a shot should be face or scene based on emotion category and position.

function getShotType(
  category: EmotionCategory,
  position: 'hook' | 'build' | 'peak' | 'release' | 'ending'
): 'face' | 'scene' {
  // Hook: scene for contrast/environment, face for immediate tension
  if (position === 'hook') {
    return category === 'high_tension' || category === 'grief' ? 'face' : 'scene'
  }
  // Build: alternate — scene first, then face
  if (position === 'build') {
    return category === 'playful' || category === 'epic' ? 'scene' : 'face'
  }
  // Peak: always face (maximum emotional impact)
  if (position === 'peak') return 'face'
  // Release: scene (breathing room, environment)
  if (position === 'release') return 'scene'
  // Ending: face for emotional closure, scene for open endings
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

// ─── Emotion Sequence Builder ─────────────────────────────────────────────────
// Maps a primary emotion into a 6-shot emotional arc.

function buildEmotionArc(primaryEmotion: string): string[] {
  const category = categorizeEmotion(primaryEmotion)

  const arcs: Record<EmotionCategory, string[]> = {
    high_tension: ['unease', 'suspicion', 'dread', 'terror', 'shock', 'silence'],
    grief:        ['memory', 'longing', 'sadness', 'grief', 'release', 'acceptance'],
    love:         ['warmth', 'tenderness', 'longing', 'love', 'joy', 'peace'],
    playful:      ['curiosity', 'mischief', 'chaos', 'laughter', 'relief', 'warmth'],
    epic:         ['struggle', 'determination', 'resistance', 'triumph', 'power', 'legacy'],
    neutral:      ['calm', 'reflection', 'realization', 'emotion', 'release', 'peace'],
  }

  return arcs[category]
}

// ─── Main Director V2 Function ────────────────────────────────────────────────

/**
 * buildExecutionPlan
 *
 * Given a primary emotion string, returns a valid ExecutionPlan with 6 shots
 * following the arc: hook → build → build → peak → release → ending.
 *
 * Shot selection is fully driven by emotion category:
 * - shot type (face vs scene) depends on emotion + position
 * - duration depends on emotion category + position
 * - emotion labels follow a narrative arc derived from the primary emotion
 */
export function buildExecutionPlan(primaryEmotion: string): ExecutionPlan {
  const category = categorizeEmotion(primaryEmotion)
  const emotionArc = buildEmotionArc(primaryEmotion)

  const positions: Array<'hook' | 'build' | 'build' | 'peak' | 'release' | 'ending'> = [
    'hook', 'build', 'build', 'peak', 'release', 'ending'
  ]

  const shots: Shot[] = positions.map((position, index) => ({
    type: getShotType(category, position),
    emotion: emotionArc[index] ?? primaryEmotion,
    duration: getShotDuration(category, position),
  }))

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
      s.duration > 0
  )
}
