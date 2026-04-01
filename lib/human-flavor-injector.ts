/**
 * Human Flavor Injector
 * Adds cinematic realism and human-feel micro-details to Kling video prompts.
 * Inspired by director-level prompt engineering for short drama production.
 */

export type FlavorIntensity = 'light' | 'medium' | 'heavy'

export interface FlavorOptions {
  intensity?: FlavorIntensity
  enableAll?: boolean
  enableMicroExpressions?: boolean
  enableEnvironmentalDetails?: boolean
  enableCinematicCamera?: boolean
  enableLightingMood?: boolean
  enableTemporalCues?: boolean
}

interface FlavorRule {
  name: string
  patterns: RegExp[]
  lightAdditions: string[]
  mediumAdditions: string[]
  heavyAdditions: string[]
}

const FLAVOR_RULES: FlavorRule[] = [
  {
    name: 'micro_expressions',
    patterns: [/look(s|ing)?|gaze|stare|eye|face|expression/i],
    lightAdditions: [
      'subtle tension in the jaw',
      'slight furrow of the brow',
      'eyes carrying unspoken emotion',
    ],
    mediumAdditions: [
      'micro-tremor at the corner of the lips',
      'pupils dilating with suppressed feeling',
      'a barely perceptible swallow',
    ],
    heavyAdditions: [
      'the ghost of a smile that never fully forms',
      'eyelids heavy with the weight of unspoken words',
      'a single blink that holds a universe of restraint',
    ],
  },
  {
    name: 'environmental_details',
    patterns: [/room|office|street|outdoor|indoor|background|setting|scene/i],
    lightAdditions: [
      'dust motes drifting in a shaft of light',
      'the faint hum of the city beyond the window',
      'a half-empty coffee cup on the desk',
    ],
    mediumAdditions: [
      'papers rustling in an unseen draft',
      'the distant sound of rain beginning to fall',
      'shadows shifting as clouds pass overhead',
    ],
    heavyAdditions: [
      'the world outside blurred and indifferent',
      'every object in the room holding its breath',
      'time itself seeming to slow in this charged space',
    ],
  },
  {
    name: 'cinematic_camera',
    patterns: [/camera|shot|angle|close.?up|wide|pan|zoom/i],
    lightAdditions: [
      'handheld with subtle organic sway',
      'rack focus pulling between foreground and background',
      'a slow push-in that builds intimacy',
    ],
    mediumAdditions: [
      'the camera breathing with the scene',
      'a Dutch angle hinting at psychological unease',
      'shallow depth of field isolating the subject',
    ],
    heavyAdditions: [
      'the lens itself seeming to hold its breath',
      'a barely perceptible drift that mirrors the character\'s uncertainty',
      'the frame tightening as the emotional stakes rise',
    ],
  },
  {
    name: 'lighting_mood',
    patterns: [/light|shadow|dark|bright|glow|sun|lamp|window/i],
    lightAdditions: [
      'golden hour warmth catching the edges',
      'soft diffused light with gentle shadows',
      'a single practical light source creating depth',
    ],
    mediumAdditions: [
      'chiaroscuro contrast echoing inner conflict',
      'light that seems to favor one character over another',
      'shadows that pool in the corners like secrets',
    ],
    heavyAdditions: [
      'illumination that feels almost confessional',
      'the light itself seeming to make a moral judgment',
      'darkness that presses in from the edges of the frame',
    ],
  },
  {
    name: 'temporal_cues',
    patterns: [/moment|pause|silence|wait|still|freeze|hold/i],
    lightAdditions: [
      'a beat of held breath',
      'the world pausing for just a fraction of a second',
      'time stretching in the space between words',
    ],
    mediumAdditions: [
      'the silence between them louder than any words',
      'a moment that will be remembered long after it passes',
      'the present tense feeling unbearably fragile',
    ],
    heavyAdditions: [
      'eternity compressed into a single heartbeat',
      'the universe contracting to this one charged instant',
      'a stillness so complete it becomes its own kind of sound',
    ],
  },
]

/**
 * Generic cinematic micro-details added to all prompts regardless of content.
 */
const UNIVERSAL_FLAVOR: Record<FlavorIntensity, string[]> = {
  light: [
    'photorealistic, cinematic quality',
    'natural human movement',
  ],
  medium: [
    'photorealistic, cinematic quality, 4K detail',
    'natural human movement with authentic micro-gestures',
    'emotionally resonant composition',
  ],
  heavy: [
    'photorealistic, cinematic quality, 4K detail, film grain',
    'natural human movement with authentic micro-gestures and breathing',
    'emotionally resonant composition with psychological depth',
    'the kind of moment that stays with you long after the scene ends',
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getAdditionsForIntensity(rule: FlavorRule, intensity: FlavorIntensity): string[] {
  switch (intensity) {
    case 'light': return rule.lightAdditions
    case 'medium': return rule.mediumAdditions
    case 'heavy': return rule.heavyAdditions
  }
}

/**
 * Inject human-feel flavor details into a Kling video prompt.
 *
 * @param rawPrompt - The original prompt text
 * @param options - Configuration for flavor injection
 * @returns Enhanced prompt with cinematic human-feel details
 */
export function injectHumanFlavors(rawPrompt: string, options: FlavorOptions = {}): string {
  const {
    intensity = 'light',
    enableAll = false,
    enableMicroExpressions = false,
    enableEnvironmentalDetails = false,
    enableCinematicCamera = false,
    enableLightingMood = false,
    enableTemporalCues = false,
  } = options

  if (!rawPrompt || typeof rawPrompt !== 'string') return rawPrompt

  const enabledRuleNames = new Set<string>()
  if (enableAll) {
    FLAVOR_RULES.forEach(r => enabledRuleNames.add(r.name))
  } else {
    if (enableMicroExpressions) enabledRuleNames.add('micro_expressions')
    if (enableEnvironmentalDetails) enabledRuleNames.add('environmental_details')
    if (enableCinematicCamera) enabledRuleNames.add('cinematic_camera')
    if (enableLightingMood) enabledRuleNames.add('lighting_mood')
    if (enableTemporalCues) enabledRuleNames.add('temporal_cues')
  }

  const injectedDetails: string[] = []

  // Apply matching rules
  for (const rule of FLAVOR_RULES) {
    if (!enabledRuleNames.has(rule.name)) continue
    const matches = rule.patterns.some(pattern => pattern.test(rawPrompt))
    if (matches) {
      const additions = getAdditionsForIntensity(rule, intensity)
      injectedDetails.push(pickRandom(additions))
    }
  }

  // Always add universal flavor
  const universalFlavors = UNIVERSAL_FLAVOR[intensity]
  for (const flavor of universalFlavors) {
    if (!rawPrompt.toLowerCase().includes(flavor.toLowerCase().split(',')[0])) {
      injectedDetails.push(flavor)
    }
  }

  if (injectedDetails.length === 0) return rawPrompt

  // Append flavor details naturally
  const deduped = [...new Set(injectedDetails)]
  return `${rawPrompt.trim()}. ${deduped.join(', ')}.`
}
