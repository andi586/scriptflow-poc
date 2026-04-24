import Anthropic from '@anthropic-ai/sdk'
import { DIRECTOR_BRAIN } from './director-brain'
import { EMOTION_ARCHETYPES, DURATION_FORMULAS, matchArchetype } from './emotion-archetypes'
import { SYMBOL_OBJECTS, SUBTEXT_TEMPLATES, EMOTION_TRANSITIONS, HOOK_FORMULAS, ENDING_FORMULAS } from './director-knowledge'
import { getKlingTemplate, getEmotionProgression, DIRECTOR_SELF_CHECK } from './film-os'
import { NEW_ARCHETYPES, matchArchetypeExtended } from './film-os'
import { getDirectorRules } from './director-rules'
import {
  buildKlingPrompt,
  type PerformanceTimeline,
  type BlockingPlan,
  type NarrativeControl,
} from './director-brain-v2'

export interface ProducerOutput {
  mode: 'social' | 'emotional' | 'artistic'
  story_category: 'pet' | 'grief' | 'love' | 'family' | 'prank' | 'achievement' | 'nostalgia' | 'hope'
  core_elements: {
    subject: string
    action: string
    characters: string[]
    tone: 'playful' | 'sad' | 'warm' | 'funny' | 'epic'
  }
  visual_constraints: {
    must_show: string[]
    forbidden_concepts: string[]
  }
  emotion_profile: {
    primary: string
    secondary: string
    abstraction_level: number
  }
  narrative_strategy: {
    structure: string
    hook: string
  }
  music_mood: string
  dialogue_style: string
}

// Keep CinematicEmotion as alias for backward compatibility
export type CinematicEmotion = ProducerOutput & {
  core_emotion: string
  visual_truth: string
  conflict: string
  visual_metaphor: string[]
  what_is_not_said: string
  what_film_feels: string
  scene_symbols: string[]
  dialogue_subtext: string
  forbidden_words: string[]
  character_arc: string
}

export interface StoryState {
  world: string
  characters: Array<{
    name: string
    role: string
    goal: string
    state: string
  }>
  relationships: string
  coreConflict: string
  narrativeGoal: string
  tensionCurve: Array<'low' | 'medium' | 'high' | 'peak'>
}

export interface DirectionPlan {
  style: 'cinematic' | 'dramatic' | 'suspense' | 'viral'
  hook: string
  shots: Array<{
    shotNumber: number
    type: 'close-up' | 'medium' | 'wide'
    cameraMovement: 'static' | 'push' | 'handheld'
    duration: number
    description: string
    emotion: string
    shotType: 'face' | 'scene'
    dialogue?: string
    scenePrompt?: string
  }>
  pacing: 'fast' | 'medium' | 'slow'
  emotionalBeats: string[]
}

export interface ExecutionPlan {
  pipeline: Array<{
    shotNumber: number
    type: 'face' | 'scene'
    duration: number
    text?: string
    scene?: string
    emotion: string
    tension: number
  }>
  totalDuration: number
  finalOutput: {
    format: 'mp4'
    aspectRatio: '9:16'
    durationTarget: string
  }
}

export interface CognitiveCoreOutput {
  storyState: StoryState
  directionPlan: DirectionPlan
  executionPlan: ExecutionPlan
  story_category: ProducerOutput['story_category']
}

function cleanJSON(text: string): string {
  // Remove markdown code blocks
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  // Remove lines starting with # (markdown headers)
  text = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n')
  // Find first { or [
  const firstBrace = text.indexOf('{')
  const firstBracket = text.indexOf('[')
  let start = -1
  if (firstBrace === -1 && firstBracket === -1) return text
  if (firstBrace === -1) start = firstBracket
  else if (firstBracket === -1) start = firstBrace
  else start = Math.min(firstBrace, firstBracket)
  text = text.substring(start)
  // Find last } or ]
  const lastBrace = text.lastIndexOf('}')
  const lastBracket = text.lastIndexOf(']')
  const end = Math.max(lastBrace, lastBracket)
  if (end !== -1) text = text.substring(0, end + 1)
  return text.trim()
}

const client = new Anthropic()

async function runProducer(userInput: string): Promise<ProducerOutput> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a grounded story producer for short-form social video (30-60 seconds).

Your job is NOT to philosophize or poeticize.
Your job is to PRESERVE the user's reality and add just enough emotion.

IRON RULES (violating any = invalid output):
1. Every entity user mentions MUST appear in output (cat → cat must be in video)
2. NEVER replace concrete with abstract (cat ≠ "being needed", naughty ≠ "existence")
3. NO philosophical statements, NO poetic lines, NO narration
4. Default mode is ALWAYS "social" unless user explicitly requests artistic style

AUTO MODE DETECTION:
- Input ≤ 15 words + concrete nouns (cat/mom/friend) = mode: "social"
- Input contains relationship words (miss/years/remember) = mode: "emotional"  
- Input contains abstract concepts = mode: "artistic"
- DEFAULT = "social"

STEP 1: Extract core elements (what user literally said)
STEP 2: Detect mode (social/emotional/artistic)
STEP 3: Output ONLY structured JSON

User Input: "${userInput}"

OUTPUT FORMAT (strict JSON, no other text):
{
  "mode": "social",
  "story_category": "pet|grief|love|family|prank|achievement|nostalgia|hope",
  "core_elements": {
    "subject": "the main subject (e.g. cat)",
    "action": "what happens (e.g. knocks things over)",
    "characters": ["user", "cat"],
    "tone": "playful|sad|warm|funny|epic"
  },
  "visual_constraints": {
    "must_show": ["cat", "knocked over objects", "user reaction"],
    "forbidden_concepts": ["philosophy", "existence", "abstract metaphors"]
  },
  "emotion_profile": {
    "primary": "mischief",
    "secondary": "affection",
    "abstraction_level": 0.1
  },
  "narrative_strategy": {
    "structure": "setup -> chaos -> reaction -> smile",
    "hook": "first 3 seconds must grab attention"
  },
  "music_mood": "playful|sad|warm|epic|funny",
  "dialogue_style": "casual and natural, max 10 words per line"
}

CRITICAL: Output ONLY a valid JSON object. No markdown. No backticks. No explanations. Start with { and end with }`
    }]
  })
  const raw = (response.content[0] as { text: string }).text
  return JSON.parse(cleanJSON(raw))
}

async function runDirector(
  producerOutput: ProducerOutput,
  template: string,
  archetypeName: string,
  shotDurations: number[],
  klingTemplate: ReturnType<typeof getKlingTemplate>,
  emotionCurve: ReturnType<typeof getEmotionProgression>,
  directorRules: ReturnType<typeof getDirectorRules>,
  durationFormula: typeof DURATION_FORMULAS[string]
): Promise<DirectionPlan> {
  const { visual_constraints, emotion_profile } = producerOutput
  const abstractionLevel = emotion_profile.abstraction_level

  const abstractionGuide = abstractionLevel <= 0.2
    ? 'abstraction_level is LOW (0.1-0.2): Show REAL objects literally. No symbolism. Cat = actual cat on screen.'
    : abstractionLevel <= 0.5
    ? 'abstraction_level is MEDIUM (0.3-0.5): Show real objects with some emotional framing. Cat can be shown with warm lighting.'
    : 'abstraction_level is HIGH (0.6+): Artistic metaphors allowed. Objects can represent emotions.'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are ScriptFlow's AI Director. You create 30-60 second viral short videos.
You think in IMAGES and SOUNDS, never in words.

DIRECTOR BRAIN - YOUR REFLEXES (follow automatically, no thinking needed):

RULES (50 iron laws):
${DIRECTOR_BRAIN.rules.join('\n')}

SHOT PATTERNS (emotion -> automatic response):
When you detect these emotions, use these patterns:
${Object.entries(DIRECTOR_BRAIN.shotPatterns).map(([emotion, data]) =>
  `${emotion}: ${data.pattern.join(' -> ')} | music: ${data.music}`
).join('\n')}

TRIGGERS (keywords -> automatic injection):
${DIRECTOR_BRAIN.triggers.map(t =>
  `[${t.keywords.join('/')}] -> archetype: ${t.archetype} -> inject: ${t.autoInject.join(', ')}`
).join('\n')}

SYMBOL OBJECTS (use these for scene shots based on emotion):
${SYMBOL_OBJECTS.map(s => `${s.emotion}: [${s.objects.join(', ')}] | camera: ${s.cameraRule} | light: ${s.lightingRule}`).join('\n')}

SUBTEXT TEMPLATES (dialogue must follow these patterns):
NEVER say the forbidden phrase. Always use the surface phrase instead.
${SUBTEXT_TEMPLATES.map(t => `${t.situation}: say "${t.surface}" (means: ${t.subtext}) | NEVER: "${t.forbidden}"`).join('\n')}

HOOK FORMULAS (shot 1 must use one of these):
${HOOK_FORMULAS.map(h => `${h.type}: ${h.description} | example: ${h.example}`).join('\n')}

ENDING FORMULAS (final shot must use one of these):
${ENDING_FORMULAS.map(e => `${e.type}: ${e.description} | music: ${e.music} | example: ${e.example}`).join('\n')}

EMOTION TRANSITIONS (use when shifting between emotions):
${EMOTION_TRANSITIONS.map(t => `${t.from}->${t.to}: ${t.transition} | camera: ${t.camera} | ${t.duration}`).join('\n')}

EMOTION PROGRESSION (follow this curve exactly):
${emotionCurve.map(s => `Shot ${s.shot}: ${s.emotion} intensity:${s.intensity} type:${s.type}`).join('\n')}

KLING PROMPT TEMPLATES (use these for each shot):
hookShot: ${klingTemplate.hookShot}
faceShot: ${klingTemplate.faceShot}
sceneShot: ${klingTemplate.sceneShot}
peakShot: ${klingTemplate.peakShot}
endingShot: ${klingTemplate.endingShot}

DIRECTOR SELF-CHECK (avoid these errors):
${DIRECTOR_SELF_CHECK.map(c => `ERROR: ${c.error} | FIX: ${c.fix} | WRONG: "${c.example.wrong}" -> CORRECT: "${c.example.correct}"`).join('\n')}

ProducerOutput: ${JSON.stringify(producerOutput)}
Template: "${template}"

${(() => {
  const archetype = EMOTION_ARCHETYPES.find(a => a.archetype === archetypeName) || EMOTION_ARCHETYPES.find(a => a.archetype === 'bittersweet')!
  return `ARCHETYPE: ${archetype.archetype} - ${archetype.description}
BLUEPRINT (follow this structure strictly): ${archetype.blueprint.join(' -> ')}
SYMBOL OBJECTS (must appear): ${archetype.symbolObjects.join(', ')}
FORBIDDEN: ${archetype.forbiddenElements.join(', ')}
MUSIC ARC: ${archetype.musicArc}
DIALOGUE STYLE: ${archetype.dialogueStyle}
SHOT DURATIONS: ${shotDurations.join('s, ')}s`
})()}

--- FILM OS ACTIVE ---
ARCHETYPE: ${archetypeName} - ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.description || '' })()}
BLUEPRINT: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.blueprint?.join(' -> ') || '' })()}
SYMBOL OBJECTS (must appear in scene shots): ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.symbolObjects?.join(', ') || '' })()}
FORBIDDEN: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.forbiddenElements?.join(', ') || '' })()}
MUSIC ARC: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.musicArc || '' })()}
DIALOGUE STYLE: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.dialogueStyle || '' })()}

DIRECTOR RULES (follow strictly):
${directorRules?.directorRules?.join('\n') || ''}
SHOT SEQUENCE: ${directorRules?.shotSequence || ''}
CAMERA STYLE: ${directorRules?.cameraStyle || ''}
LIGHTING: ${directorRules?.lightingDirective || ''}
PACING: ${directorRules?.pacingDirective || ''}
DIALOGUE: ${directorRules?.dialogueDirective || ''}
MUSIC: ${directorRules?.musicDirective || ''}

EMOTION CURVE (follow exactly):
${emotionCurve?.map(s => `Shot${s.shot}: ${s.emotion} intensity:${s.intensity} type:${s.type}`).join('\n') || ''}

SHOT DURATIONS: ${durationFormula.distribution.join('s, ')}s


REALITY ANCHOR RULES (MANDATORY):
- must_show items: ${JSON.stringify(visual_constraints.must_show)}
  -> Every item in must_show MUST appear in at least 2 shots
- forbidden_concepts: ${JSON.stringify(visual_constraints.forbidden_concepts)}
  -> NEVER use these concepts in any shot

ABSTRACTION GUIDE:
${abstractionGuide}

--- IRON RULES (violating any = output invalid) ---

1. HOOK RULE: Shot 1 must be Extreme Close-Up OR Extreme Wide Shot. Never medium shot.
2. ONE SHOT = ONE IDEA: Each shot expresses exactly one thing. No exceptions.
3. SHOW DON'T TELL: Zero narration. Zero explanation. Zero internal monologue.
4. ENTITY LOCK: Every item in must_show MUST appear in at least 2 shots.
5. DIALOGUE CAP: Max 10 words per line. Must have subtext. Never explain the scene.
6. FORBIDDEN WORDS in dialogue: feel, think, realize, understand, beautiful, sad, naughty, exist, alive.
7. ESCALATION: Emotion must build shot by shot. Never flat.
8. END WITH SILENCE: Final shot = static wide shot OR extreme close-up. Let it breathe.

--- 10 CINEMATIC RULES ---

RULE 1: Late in, Early out
-> Start at the KEY moment, not the setup
-> Example: Start with cup FALLING, not cat approaching cup

RULE 2: Shot Size = Emotion Intensity
-> Wide = relationship/loneliness
-> Medium = action/context  
-> Close = emotion/reaction
-> Extreme Close = peak emotion ONLY

RULE 3: Camera Movement = Emotional Direction
-> Slow push-in = intimacy/tension growing
-> Dolly out = isolation/release
-> Handheld = chaos/reality/urgency
-> Static = emptiness/weight/peace

RULE 4: Lighting = Mood
-> Warm golden side light = happiness/memory
-> Cold blue = loneliness/sadness
-> High contrast = drama/conflict
-> Soft diffused = tenderness/hope

RULE 5: Object as Emotion (use for scene shots)
-> Spilled water spreading = chaos/time passing
-> Empty chair = absence/longing
-> Steam from cup = warmth/life
-> Falling object = loss of control
-> Cat sitting still = innocence/indifference

RULE 6: Sound Design is mandatory
-> Every shot needs: ambient sound OR music cue OR silence (silence IS a choice)
-> J-Cut: next shot's sound starts 1 second before cut

RULE 7: Dialogue must be subtext
-> BAD: "You knocked it over again" (explains what we see)
-> GOOD: "Today... you win." (says one thing, means another)

RULE 8: Shot sequence must escalate
-> emotion_intensity must increase shot by shot
-> Peak at shot 4-5, then release at final shot

RULE 9: Composition matters
-> Rule of thirds: subjects on intersection points
-> Negative space: loneliness = subject in corner
-> Symmetry = order/control
-> Asymmetry = chaos/freedom

RULE 10: 30-60 second structure
-> Shot 1-2 (0-6s): HOOK - visual conflict or surprise
-> Shot 3-4 (6-25s): BUILD - escalate the story
-> Shot 5-6 (25-50s): PEAK - emotional high point
-> Shot 7-8 (50-60s): BREATH - lingering silence

--- EXAMPLE (Input: cat is naughty) ---

Shot 1 (HOOK): ECU of ceramic cup edge, cat paw enters frame from left, slow push
Shot 2 (BUILD): CU of water spreading on white floor, cat tail visible at edge  
Shot 3 (BUILD): MCU user face reflected in mirror, slow realization expression
Shot 4 (PEAK): MS user and cat facing each other, symmetrical, tense silence
Shot 5 (DIALOGUE): CU user face slight smile, says: "Today... you win."
Shot 6 (BREATH): WS room with both, cat sits unbothered, user laughs

--- MUSIC DIRECTION ---
-> Face shots (dialogue): music OFF (let words breathe)
-> Scene shots (objects): music ON low volume (fill emotional void)  
-> Peak shot: music crescendo
-> Final breath shot: music fade out

--- OUTPUT FORMAT ---

Output ONLY valid JSON. No other text. Use this exact structure:
{
  "style": "cinematic",
  "hook": "first line that grabs attention",
  "pacing": "fast|medium|slow",
  "emotionalBeats": ["hook", "build", "peak", "breath"],
  "shots": [
    {
      "shotNumber": 1,
      "shotType": "face|scene",
      "duration": 3,
      "type": "ECU|CU|MCU|MS|WS|EWS",
      "cameraMovement": "static|slow-push-in|dolly-out|handheld|tracking|crane-up",
      "composition": "rule-of-thirds|symmetrical|negative-space|centered",
      "lighting": "warm-golden|cold-blue|high-contrast|soft-diffused|neon",
      "description": "CONCRETE physical description. What camera literally sees.",
      "scenePrompt": "for scene shots: detailed visual prompt, no people",
      "dialogue": "Max 10 words OR empty string",
      "soundDesign": "specific ambient sound or music cue",
      "emotion": "emotion label",
      "emotionIntensity": 1,
      "musicDirection": {
        "play": false,
        "volume": 0,
        "fadeIn": false
      }
    }
  ]
}

CRITICAL: Output ONLY a valid JSON object. No markdown. No backticks. No explanations. Start with { and end with }`
    }]
  })
  const raw = (response.content[0] as { text: string }).text
  return JSON.parse(cleanJSON(raw))
}

function checkRealityAnchors(plan: DirectionPlan, mustShow: string[]): void {
  const allText = plan.shots
    .map(s => `${s.description || ''} ${s.scenePrompt || ''} ${s.dialogue || ''}`)
    .join(' ')
    .toLowerCase()

  for (const item of mustShow) {
    if (!allText.includes(item.toLowerCase())) {
      console.warn(`[CognitiveCore] Reality anchor MISSING: "${item}" not found in any shot`)
    } else {
      console.log(`[CognitiveCore] Reality anchor OK: "${item}" ✓`)
    }
  }
}

const MAX_FACE_CHARS = 20

function validateAndFixFaceShots(plan: DirectionPlan): { plan: DirectionPlan; violations: string[] } {
  const violations: string[] = []
  const fixed = { ...plan, shots: plan.shots.map(shot => {
    if (shot.shotType !== 'face' || !shot.dialogue) return shot
    const charCount = shot.dialogue.replace(/\s/g, '').length
    if (charCount > MAX_FACE_CHARS) {
      violations.push(`Shot ${shot.shotNumber}: "${shot.dialogue}" (${charCount} chars > ${MAX_FACE_CHARS} limit)`)
      const firstSentence = shot.dialogue.split(/[。！？.!?]/)[0]
      const truncated = firstSentence.length <= MAX_FACE_CHARS
        ? firstSentence + (shot.dialogue.includes('...') ? '...' : '。')
        : shot.dialogue.slice(0, MAX_FACE_CHARS - 3) + '...'
      return { ...shot, dialogue: truncated }
    }
    return shot
  })}
  return { plan: fixed, violations }
}

async function runNEL(
  directionPlan: DirectionPlan,
  klingTemplate: ReturnType<typeof getKlingTemplate>,
  archetypeName: string,
  emotionCurve: ReturnType<typeof getEmotionProgression>
): Promise<ExecutionPlan> {
  // Build Director Brain v2 systems from archetype + emotion curve
  const performanceTimeline: PerformanceTimeline = {
    duration: directionPlan.shots.reduce((sum, s) => sum + s.duration, 0),
    frames: emotionCurve.map(s => ({
      t: s.shot * 2,
      emotion: s.intensity >= 8 ? 'release' : s.intensity >= 5 ? 'tension' : 'suppressed',
      micro: s.intensity >= 8 ? 'jaw_clench' : s.intensity >= 5 ? 'lip_press' : 'blink_slow',
      breath: s.intensity >= 8 ? 'hold' : s.intensity >= 5 ? 'shallow' : 'release',
      gaze: s.shot === 1 ? 'lock' : s.intensity >= 7 ? 'down' : 'avoid',
    })),
  }

  const narrativeControl: NarrativeControl = {
    layers: emotionCurve.map((s, i) => ({
      viewerKnows: i > 0,
      characterKnows: s.intensity >= 6,
      revealAt: s.shot * 2,
    })),
  }

  const blockingPlan: BlockingPlan = {
    zMovement: 'push_in',
    depth: 'shallow',
    foreground: true,
    midground: true,
    background: false,
  }

  const kt = klingTemplate as Record<string, string>

  const pipeline = directionPlan.shots.map((shot, i) => {
    // Select base template based on shot type and position
    const isHook = i === 0
    const isPeak = i === Math.floor(directionPlan.shots.length * 0.6)
    const isEnding = i === directionPlan.shots.length - 1
    const baseTemplate = isHook
      ? (kt?.hookShot || '')
      : isPeak
      ? (kt?.peakShot || '')
      : isEnding
      ? (kt?.endingShot || '')
      : shot.shotType === 'face'
      ? (kt?.faceShot || '')
      : (kt?.sceneShot || '')

    // Build enriched Kling prompt using Director Brain v2
    const finalPrompt = buildKlingPrompt(
      baseTemplate,
      performanceTimeline,
      blockingPlan,
      narrativeControl
    )

    console.log(`[NEL] Shot ${shot.shotNumber} finalPrompt (first 80): ${finalPrompt.slice(0, 80)}`)

    return {
      shotNumber: shot.shotNumber,
      type: shot.shotType,
      duration: shot.duration,
      text: shot.dialogue,
      scene: shot.scenePrompt,
      emotion: shot.emotion,
      tension: Math.floor((i / directionPlan.shots.length) * 10),
      klingPrompt: finalPrompt,
    }
  })

  return {
    pipeline,
    totalDuration: pipeline.reduce((sum, s) => sum + s.duration, 0),
    finalOutput: {
      format: 'mp4',
      aspectRatio: '9:16',
      durationTarget: '60-90s'
    }
  }
}

export async function runCognitiveCore(userInput: string, template: string): Promise<CognitiveCoreOutput> {
  console.log('[CognitiveCore] Starting Producer...')
  const producerOutput = await runProducer(userInput)
  console.log('[CognitiveCore] mode:', producerOutput.mode, 'story_category:', producerOutput.story_category)
  console.log('[CognitiveCore] must_show:', producerOutput.visual_constraints.must_show)

  // Build a StoryState-compatible object from ProducerOutput for backward compatibility
  const storyState: StoryState = {
    world: producerOutput.core_elements.subject,
    characters: producerOutput.core_elements.characters.map(c => ({
      name: c, role: c, goal: producerOutput.narrative_strategy.structure, state: producerOutput.emotion_profile.primary
    })),
    relationships: producerOutput.dialogue_style,
    coreConflict: producerOutput.core_elements.action,
    narrativeGoal: producerOutput.narrative_strategy.hook,
    tensionCurve: ['low', 'medium', 'high', 'peak']
  }

  const archetypeName = matchArchetype(userInput)
  const tier = '60s' // default tier; can be parameterized later
  const durationFormula = DURATION_FORMULAS[tier] || DURATION_FORMULAS['60s']
  const shotDurations = durationFormula.distribution
  const klingTemplate = getKlingTemplate(archetypeName)
  const emotionCurve = getEmotionProgression(archetypeName)

  const ALL_ARCHETYPES = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]
  const archetype = matchArchetypeExtended(userInput)
  const archetypeData = ALL_ARCHETYPES.find(a => a.archetype === archetype)
  const directorRules = getDirectorRules(archetype)
  const durationFormulaFilmOS = DURATION_FORMULAS[tier] || DURATION_FORMULAS['30s']

  console.log('[CognitiveCore] archetype matched:', archetype)
  console.log('[CognitiveCore] archetype:', archetypeName, '| shotDurations:', shotDurations)
  console.log('[CognitiveCore] klingTemplate hookShot:', klingTemplate.hookShot.slice(0, 60))

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(producerOutput, template, archetypeName, shotDurations, klingTemplate, emotionCurve, directorRules, durationFormula)

  console.log('[CognitiveCore] Checking reality anchors...')
  checkRealityAnchors(rawDirectionPlan, producerOutput.visual_constraints.must_show)

  console.log('[CognitiveCore] Validating face shot lengths...')
  const { plan: directionPlan, violations } = validateAndFixFaceShots(rawDirectionPlan)
  if (violations.length > 0) {
    console.warn('[CognitiveCore] Face shot violations fixed:', violations)
  } else {
    console.log('[CognitiveCore] All face shots passed validation ✓')
  }

  console.log('[CognitiveCore] Starting NEL...')
  const executionPlan = await runNEL(directionPlan, klingTemplate, archetypeName, emotionCurve)

  console.log('[CognitiveCore] Complete. Total shots:', executionPlan.pipeline.length)
  return { storyState, directionPlan, executionPlan, story_category: producerOutput.story_category }
}
