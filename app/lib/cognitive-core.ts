import Anthropic from '@anthropic-ai/sdk'
import { DIRECTOR_BRAIN } from './director-brain'
import { EMOTION_ARCHETYPES, DURATION_FORMULAS, matchArchetype } from './emotion-archetypes'

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
    "structure": "setup → chaos → reaction → smile",
    "hook": "first 3 seconds must grab attention"
  },
  "music_mood": "playful|sad|warm|epic|funny",
  "dialogue_style": "casual and natural, max 10 words per line"
}`
    }]
  })
  const raw = (response.content[0] as { text: string }).text
  let clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    clean = clean.slice(start, end + 1)
  }
  return JSON.parse(clean)
}

async function runDirector(producerOutput: ProducerOutput, template: string, archetypeName: string, shotDurations: number[]): Promise<DirectionPlan> {
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

SHOT PATTERNS (emotion → automatic response):
When you detect these emotions, use these patterns:
${Object.entries(DIRECTOR_BRAIN.shotPatterns).map(([emotion, data]) =>
  `${emotion}: ${data.pattern.join(' → ')} | music: ${data.music}`
).join('\n')}

TRIGGERS (keywords → automatic injection):
${DIRECTOR_BRAIN.triggers.map(t =>
  `[${t.keywords.join('/')}] → archetype: ${t.archetype} → inject: ${t.autoInject.join(', ')}`
).join('\n')}


ProducerOutput: ${JSON.stringify(producerOutput)}
Template: "${template}"

${(() => {
  const archetype = EMOTION_ARCHETYPES.find(a => a.archetype === archetypeName) || EMOTION_ARCHETYPES.find(a => a.archetype === 'bittersweet')!
  return `ARCHETYPE: ${archetype.archetype} - ${archetype.description}
BLUEPRINT (follow this structure strictly): ${archetype.blueprint.join(' → ')}
SYMBOL OBJECTS (must appear): ${archetype.symbolObjects.join(', ')}
FORBIDDEN: ${archetype.forbiddenElements.join(', ')}
MUSIC ARC: ${archetype.musicArc}
DIALOGUE STYLE: ${archetype.dialogueStyle}
SHOT DURATIONS: ${shotDurations.join('s, ')}s`
})()}


REALITY ANCHOR RULES (MANDATORY):
- must_show items: ${JSON.stringify(visual_constraints.must_show)}
  → Every item in must_show MUST appear in at least 2 shots
- forbidden_concepts: ${JSON.stringify(visual_constraints.forbidden_concepts)}
  → NEVER use these concepts in any shot

ABSTRACTION GUIDE:
${abstractionGuide}

═══ IRON RULES (violating any = output invalid) ═══

1. HOOK RULE: Shot 1 must be Extreme Close-Up OR Extreme Wide Shot. Never medium shot.
2. ONE SHOT = ONE IDEA: Each shot expresses exactly one thing. No exceptions.
3. SHOW DON'T TELL: Zero narration. Zero explanation. Zero internal monologue.
4. ENTITY LOCK: Every item in must_show MUST appear in at least 2 shots.
5. DIALOGUE CAP: Max 10 words per line. Must have subtext. Never explain the scene.
6. FORBIDDEN WORDS in dialogue: feel, think, realize, understand, beautiful, sad, naughty, exist, alive.
7. ESCALATION: Emotion must build shot by shot. Never flat.
8. END WITH SILENCE: Final shot = static wide shot OR extreme close-up. Let it breathe.

═══ 10 CINEMATIC RULES ═══

RULE 1: Late in, Early out
→ Start at the KEY moment, not the setup
→ Example: Start with cup FALLING, not cat approaching cup

RULE 2: Shot Size = Emotion Intensity
→ Wide = relationship/loneliness
→ Medium = action/context  
→ Close = emotion/reaction
→ Extreme Close = peak emotion ONLY

RULE 3: Camera Movement = Emotional Direction
→ Slow push-in = intimacy/tension growing
→ Dolly out = isolation/release
→ Handheld = chaos/reality/urgency
→ Static = emptiness/weight/peace

RULE 4: Lighting = Mood
→ Warm golden side light = happiness/memory
→ Cold blue = loneliness/sadness
→ High contrast = drama/conflict
→ Soft diffused = tenderness/hope

RULE 5: Object as Emotion (use for scene shots)
→ Spilled water spreading = chaos/time passing
→ Empty chair = absence/longing
→ Steam from cup = warmth/life
→ Falling object = loss of control
→ Cat sitting still = innocence/indifference

RULE 6: Sound Design is mandatory
→ Every shot needs: ambient sound OR music cue OR silence (silence IS a choice)
→ J-Cut: next shot's sound starts 1 second before cut

RULE 7: Dialogue must be subtext
→ BAD: "You knocked it over again" (explains what we see)
→ GOOD: "Today... you win." (says one thing, means another)

RULE 8: Shot sequence must escalate
→ emotion_intensity must increase shot by shot
→ Peak at shot 4-5, then release at final shot

RULE 9: Composition matters
→ Rule of thirds: subjects on intersection points
→ Negative space: loneliness = subject in corner
→ Symmetry = order/control
→ Asymmetry = chaos/freedom

RULE 10: 30-60 second structure
→ Shot 1-2 (0-6s): HOOK - visual conflict or surprise
→ Shot 3-4 (6-25s): BUILD - escalate the story
→ Shot 5-6 (25-50s): PEAK - emotional high point
→ Shot 7-8 (50-60s): BREATH - lingering silence

═══ EXAMPLE (Input: cat is naughty) ═══

Shot 1 (HOOK): ECU of ceramic cup edge, cat paw enters frame from left, slow push
Shot 2 (BUILD): CU of water spreading on white floor, cat tail visible at edge  
Shot 3 (BUILD): MCU user face reflected in mirror, slow realization expression
Shot 4 (PEAK): MS user and cat facing each other, symmetrical, tense silence
Shot 5 (DIALOGUE): CU user face slight smile, says: "Today... you win."
Shot 6 (BREATH): WS room with both, cat sits unbothered, user laughs

═══ MUSIC DIRECTION ═══
→ Face shots (dialogue): music OFF (let words breathe)
→ Scene shots (objects): music ON low volume (fill emotional void)  
→ Peak shot: music crescendo
→ Final breath shot: music fade out

═══ OUTPUT FORMAT ═══

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
}`
    }]
  })
  const raw = (response.content[0] as { text: string }).text
  let clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    clean = clean.slice(start, end + 1)
  }
  return JSON.parse(clean)
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

async function runNEL(directionPlan: DirectionPlan): Promise<ExecutionPlan> {
  const pipeline = directionPlan.shots.map((shot, i) => ({
    shotNumber: shot.shotNumber,
    type: shot.shotType,
    duration: shot.duration,
    text: shot.dialogue,
    scene: shot.scenePrompt,
    emotion: shot.emotion,
    tension: Math.floor((i / directionPlan.shots.length) * 10)
  }))

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
  console.log('[CognitiveCore] archetype:', archetypeName, '| shotDurations:', shotDurations)

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(producerOutput, template, archetypeName, shotDurations)

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
  const executionPlan = await runNEL(directionPlan)

  console.log('[CognitiveCore] Complete. Total shots:', executionPlan.pipeline.length)
  return { storyState, directionPlan, executionPlan, story_category: producerOutput.story_category }
}
