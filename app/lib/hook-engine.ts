// AI-GENERATED: hook-engine.ts
// Purpose: Generate the first HOOK shot that maximizes attention in the first 1 second.
// Standalone module — does NOT modify director-v2.ts or any existing file.
// Compatible with ExecutionPlan Shot interface from director-v2.ts.

// ─── Input Interface ──────────────────────────────────────────────────────────

interface Shot {
  type: 'face' | 'scene'
  emotion: string
  duration: number
  intensity: number
  purpose: 'hook' | 'build' | 'peak' | 'release' | 'ending'
}

// ─── Output Interface ─────────────────────────────────────────────────────────

export interface HookShot {
  visual: string   // 0–1s: visual shock layer
  audio: string    // 1–3s: emotion injection layer
  text: string     // 1–3s: curiosity text (max 10 words, incomplete sentence)
  duration: number // total hook duration in seconds (always 5)
}

// ─── Emotion Category ─────────────────────────────────────────────────────────

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
  // Try direct match first
  if (EMOTION_CATEGORY_MAP[normalized]) return EMOTION_CATEGORY_MAP[normalized]
  // Try partial match against keys
  for (const [key, cat] of Object.entries(EMOTION_CATEGORY_MAP)) {
    if (normalized.includes(key)) return cat
  }
  return 'neutral'
}

// ─── 3-Layer Hook Templates ───────────────────────────────────────────────────
// Each category has:
//   visual: 0–1s shock (ECU / unexpected motion / strong contrast)
//   audio:  1–3s emotion injection (breath / pause / whisper / sharp sound)
//   text:   1–3s curiosity text (max 10 words, incomplete sentence)
// Layer 3 (3–5s) is tension via incomplete information — encoded in text + visual hold.

interface HookTemplate {
  visual: string
  audio: string
  text: string
}

const HOOK_TEMPLATES: Record<EmotionCategory, HookTemplate[]> = {
  high_tension: [
    {
      visual: 'ECU: hand slamming flat on surface, sudden freeze — high contrast harsh light',
      audio: 'sharp intake of breath, then dead silence',
      text: 'Wait. Something is very wrong…',
    },
    {
      visual: 'unexpected motion: object falling in slow motion, extreme close-up impact',
      audio: 'low whisper: "no… no…", then silence',
      text: 'I didn\'t think it would end like—',
    },
    {
      visual: 'strong contrast: face half in shadow, one eye visible, completely still',
      audio: 'single sharp sound, then breath held',
      text: 'They knew. They always knew.',
    },
  ],
  grief: [
    {
      visual: 'ECU: empty chair at a table, dust particles in still light',
      audio: 'slow exhale, barely audible, then silence',
      text: 'It\'s been a year since…',
    },
    {
      visual: 'strong contrast: object left behind, dark room, single beam of light',
      audio: 'quiet breath, pause, soft ambient hum',
      text: 'I still can\'t throw it away.',
    },
    {
      visual: 'ECU: hand touching a photograph, fingertip trembling slightly',
      audio: 'silence, then a single slow breath',
      text: 'I thought I was over it.',
    },
  ],
  love: [
    {
      visual: 'ECU: two hands almost touching, extreme shallow depth of field',
      audio: 'soft breath, pause, quiet ambient warmth',
      text: 'I almost said it that night…',
    },
    {
      visual: 'unexpected motion: someone turning around slowly, face not yet visible',
      audio: 'whisper: "I never told you…", then silence',
      text: 'There\'s something you don\'t know.',
    },
    {
      visual: 'strong contrast: warm light on one face, other in shadow, both still',
      audio: 'slow breath, soft ambient, pause',
      text: 'It was always you.',
    },
  ],
  playful: [
    {
      visual: 'unexpected motion: object flying into frame from off-screen, freeze',
      audio: 'quick rhythm tap, then sudden silence',
      text: 'Nobody saw what happened next.',
    },
    {
      visual: 'ECU: eyes going wide, eyebrows shooting up, mouth starting to open',
      audio: 'quick breath in, then cut to silence',
      text: 'Wait — did that just…',
    },
    {
      visual: 'strong contrast: bright object in dark frame, sudden movement',
      audio: 'quick beat, pause, then nothing',
      text: 'I can\'t believe I did this.',
    },
  ],
  epic: [
    {
      visual: 'ECU: fist clenching slowly, knuckles whitening, extreme close-up',
      audio: 'deep breath held, low rumble, silence',
      text: 'They said I couldn\'t. So I—',
    },
    {
      visual: 'strong contrast: silhouette rising against bright background, slow motion',
      audio: 'single sharp breath, then silence',
      text: 'Everything changes after this moment.',
    },
    {
      visual: 'unexpected motion: sudden stand from seated position, camera follows',
      audio: 'low whisper: "watch me", then silence',
      text: 'I was done being afraid.',
    },
  ],
  neutral: [
    {
      visual: 'ECU: eyes shifting slowly to look directly at camera, extreme still',
      audio: 'quiet breath, long pause, ambient silence',
      text: 'Something happened I can\'t explain.',
    },
    {
      visual: 'strong contrast: single object in empty frame, light shifting slowly',
      audio: 'slow exhale, then complete silence',
      text: 'I didn\'t expect to feel this.',
    },
    {
      visual: 'unexpected motion: slow turn toward camera, face revealed gradually',
      audio: 'soft breath, pause, ambient hum',
      text: 'It started with one small thing.',
    },
  ],
}

// ─── Hook Shot Generator ──────────────────────────────────────────────────────

/**
 * generateHookShot
 *
 * Takes the first Shot from an ExecutionPlan (purpose: 'hook') and the primary emotion,
 * and returns a HookShot with a 3-layer structure:
 *   - 0–1s: visual shock (ECU / unexpected motion / strong contrast)
 *   - 1–3s: emotion injection (audio + text)
 *   - 3–5s: tension via incomplete information (held in text + visual)
 *
 * If the shot is not a hook shot, still generates a hook based on emotion.
 */
export function generateHookShot(shot: Shot, primaryEmotion: string): HookShot {
  const category = categorizeEmotion(primaryEmotion)
  const templates = HOOK_TEMPLATES[category]

  // Select template based on shot intensity (0-2 index)
  const templateIndex = shot.intensity >= 8 ? 0 : shot.intensity >= 5 ? 1 : 2
  const template = templates[templateIndex] ?? templates[0]

  return {
    visual: template.visual,
    audio: template.audio,
    text: template.text,
    duration: 5, // always 5 seconds: 0-1s shock + 1-3s injection + 3-5s tension
  }
}

// ─── Utility: Validate HookShot ──────────────────────────────────────────────

export function validateHookShot(hook: HookShot): boolean {
  if (!hook) return false
  const wordCount = hook.text.trim().split(/\s+/).length
  return (
    typeof hook.visual === 'string' && hook.visual.length > 0 &&
    typeof hook.audio === 'string' && hook.audio.length > 0 &&
    typeof hook.text === 'string' && wordCount <= 10 &&
    typeof hook.duration === 'number' && hook.duration > 0
  )
}
