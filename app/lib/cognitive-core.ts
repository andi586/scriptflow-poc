import Anthropic from '@anthropic-ai/sdk'

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

async function runDirector(producerOutput: ProducerOutput, template: string): Promise<DirectionPlan> {
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
      content: `You are a film director trained by Wong Kar-wai, Hirokazu Kore-eda, and Christopher Nolan.
You receive a structured ProducerOutput and translate it into a shot list.

ProducerOutput: ${JSON.stringify(producerOutput)}
Template: "${template}"

REALITY ANCHOR RULES (MANDATORY):
- must_show items: ${JSON.stringify(visual_constraints.must_show)}
  → Every item in must_show MUST appear in at least 1 shot description or scenePrompt
  → If "cat" is in must_show, cat MUST appear in at least 2 shots
- forbidden_concepts: ${JSON.stringify(visual_constraints.forbidden_concepts)}
  → NEVER use these concepts in any shot

ABSTRACTION GUIDE:
${abstractionGuide}

STRICT CINEMATIC PROTOCOL:

Every shot is categorized as ONE of:
- SHOT: purely visual, no people allowed in scene shots
- DIALOGUE: spoken words only, max 8 words, must have subtext
- SOUND: non-verbal audio only

FORBIDDEN in any output:
- Narration or voiceover
- Explaining emotions with words
- "he feels", "she thinks", "as if", "seems like"
- Dialogue that describes what is visible on screen
- Any concept from forbidden_concepts list

DIALOGUE RULES:
- Maximum 8 words
- Must have subtext (surface meaning ≠ real meaning)
- Incomplete sentences preferred
- Style: ${producerOutput.dialogue_style}
- NEVER use forbidden_concepts

SCENE SHOT RULES:
- Must include must_show items
- Camera movement must match tone: ${producerOutput.core_elements.tone}
- Each scene shot = one concrete visual moment

Output ALL text in English only.
Scene descriptions must be in English with specific physical objects.

EXAMPLE for cat story (must_show: cat):
- Scene shot: 'Overturned glass on white floor, water spreading, cat's paw print at the edge'
- Dialogue: 'Again... really?' (with a hidden smile)
- Scene shot: 'Sunlight through window, cat sitting perfectly still, pretending innocence'

Create 6 shots alternating: face, scene, face, scene, face, scene
Each shot duration: 2-3 seconds

Return ONLY valid JSON (no markdown):
{
  "style": "cinematic",
  "hook": "first line that grabs attention",
  "shots": [
    {
      "shotNumber": 1,
      "type": "close-up",
      "cameraMovement": "static",
      "duration": 3,
      "description": "person speaking",
      "emotion": "tender",
      "shotType": "face",
      "dialogue": "Again... really?"
    },
    {
      "shotNumber": 2,
      "type": "wide",
      "cameraMovement": "push",
      "duration": 2,
      "description": "cat next to overturned glass",
      "emotion": "mischief",
      "shotType": "scene",
      "scenePrompt": "overturned glass on white floor, water spreading, cat sitting nearby looking innocent, no people"
    }
  ],
  "pacing": "fast",
  "emotionalBeats": ["setup", "chaos", "reaction", "smile"]
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

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(producerOutput, template)

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
