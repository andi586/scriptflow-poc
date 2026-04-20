import Anthropic from '@anthropic-ai/sdk'

export interface CinematicEmotion {
  core_emotion: string
  visual_truth: string
  conflict: string
  visual_metaphor: string[]
  what_is_not_said: string
  what_film_feels: string
  scene_symbols: string[]
  dialogue_subtext: string
  music_mood: string
  forbidden_words: string[]
  character_arc: string
  story_category: 'grief' | 'love' | 'family' | 'pet' | 'prank' | 'achievement' | 'nostalgia' | 'hope'
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
  story_category: CinematicEmotion['story_category']
}

const client = new Anthropic()

async function runProducer(userInput: string): Promise<CinematicEmotion> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a master film producer. Your ONLY job is to translate everyday human language into pure cinematic emotion structure.

You are a TRANSLATOR between:
- What users SAY (everyday language)  
- What films FEEL (pure emotion, conflict, visual truth)

TRANSLATION RULES:

CURRENT MODE: SOCIAL VIDEO (30-60 seconds, TikTok/Instagram style)

MOST IMPORTANT RULE: Keep the user's story LITERAL first.
- User says 'cat' → CAT must appear in the video
- User says 'mom' → MOM's presence must be felt
- User says 'prank' → PRANK must be the focus
NEVER lose the original subject. NEVER over-philosophize.

Step 1: Understand LITERALLY what happened first.
Examples:
- "我的猫咪今天很调皮" → NOT about a cat. ABOUT: warmth, chaos as love, being needed by another living thing
- "妈妈我想你" → NOT about missing mom. ABOUT: time's cruelty, unfinished conversations, love outlasting death
- "失恋了" → NOT about a breakup. ABOUT: the version of yourself that no longer exists
- "儿子今天上学了" → NOT about school. ABOUT: time moving without permission, pride mixed with loss

Step 2: Find the UNIVERSAL HUMAN TRUTH.
Every story maps to one of these:
- grief: love and loss, missing someone
- love: romantic connection, tenderness
- family: belonging, roots, generational bonds
- pet: unconditional love, chaos as joy
- prank: friendship, laughter, inside jokes
- achievement: triumph, growth, pride
- nostalgia: time passing, memory, home
- hope: new beginnings, possibility

Step 3: Find the VISUAL METAPHORS (3-5 physical objects that carry the emotion).
Examples:
- longing → empty chair, cold cup of tea, stopped clock
- cat mischief as love → broken cup, spreading water, cat tail swaying
- grief → fallen photo frame, wilting flower, rain on window
- hope → morning light through curtain, open door, sprouting plant

Step 4: Define what must NOT be said (forbidden words/phrases for dialogue).
These are things too obvious to say - the subtext lives in what's unsaid.

CRITICAL RULE: Never lose the concrete story elements.
If user mentions a CAT → cat must appear in the film
If user mentions MOM → mom's presence must be felt in scenes
If user mentions RAIN → rain must be in the visuals

You can find deeper meaning BUT you cannot erase the original subject.

BAD: User says 'my cat is naughty' → Producer outputs abstract philosophy with no cat
GOOD: User says 'my cat is naughty' → Producer outputs cat-centered story with deeper meaning (chaos as love, being needed)

User Input: "${userInput}"

Return ONLY valid JSON matching this interface. No markdown:
{
  "core_emotion": "string",
  "visual_truth": "string",
  "conflict": "string",
  "visual_metaphor": ["string", "string", "string"],
  "what_is_not_said": "string",
  "what_film_feels": "string",
  "scene_symbols": ["string", "string", "string"],
  "dialogue_subtext": "string",
  "music_mood": "string",
  "forbidden_words": ["string", "string"],
  "character_arc": "string",
  "story_category": "grief|love|family|pet|prank|achievement|nostalgia|hope"
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

async function runDirector(cinematicEmotion: CinematicEmotion, template: string): Promise<DirectionPlan> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a film director trained by Wong Kar-wai, Hirokazu Kore-eda, and Christopher Nolan.
You receive a CinematicEmotion structure from the Producer and translate it into a shot list.

You NEVER receive raw user text. You only work with cinematic emotion structures.

CinematicEmotion: ${JSON.stringify(cinematicEmotion)}
Template: "${template}"

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

DIALOGUE RULES:
- Maximum 8 words
- Must have subtext (surface meaning ≠ real meaning)
- Incomplete sentences preferred
- Use the visual_metaphors from Producer output
- Use the scene_symbols from Producer output
- NEVER use forbidden_words from Producer output

SCENE SHOT RULES (no people):
- Use scene_symbols from Producer output as visual anchors
- Each scene shot = one emotional symbol
- Camera movement must match emotion (slow push = grief, static = emptiness, drift = confusion)

Output ALL text in English only.
Dialogue must be in English (or the language that fits the character).
Scene descriptions must be in English with specific physical objects.

EXAMPLE for cat story:
- Scene shot: 'Overturned glass on white floor, water spreading, cat's paw print at the edge'
- Dialogue: 'Again... really?' (with a hidden smile)
- Scene shot: 'Sunlight through window, cat sitting perfectly still, pretending innocence'

Keep the cat/dog/pet VISIBLE in scene shots when story is about pets.

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
      "dialogue": "妈妈... 我想你。"
    },
    {
      "shotNumber": 2,
      "type": "wide",
      "cameraMovement": "push",
      "duration": 2,
      "description": "empty room",
      "emotion": "lonely",
      "shotType": "scene",
      "scenePrompt": "empty room with warm candlelight, no people, no humans"
    }
  ],
  "pacing": "slow",
  "emotionalBeats": ["setup", "build", "peak", "release"]
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

const MAX_FACE_CHARS = 20

function validateAndFixFaceShots(plan: DirectionPlan): { plan: DirectionPlan; violations: string[] } {
  const violations: string[] = []
  const fixed = { ...plan, shots: plan.shots.map(shot => {
    if (shot.shotType !== 'face' || !shot.dialogue) return shot
    const charCount = shot.dialogue.replace(/\s/g, '').length
    if (charCount > MAX_FACE_CHARS) {
      violations.push(`Shot ${shot.shotNumber}: "${shot.dialogue}" (${charCount} chars > ${MAX_FACE_CHARS} limit)`)
      // Truncate to first sentence or first MAX_FACE_CHARS chars
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
  const cinematicEmotion = await runProducer(userInput)
  console.log('[CognitiveCore] story_category:', cinematicEmotion.story_category)

  // Build a StoryState-compatible object from CinematicEmotion for backward compatibility
  const storyState: StoryState = {
    world: cinematicEmotion.visual_truth,
    characters: [{ name: 'protagonist', role: 'main', goal: cinematicEmotion.character_arc, state: cinematicEmotion.core_emotion }],
    relationships: cinematicEmotion.dialogue_subtext,
    coreConflict: cinematicEmotion.conflict,
    narrativeGoal: cinematicEmotion.what_film_feels,
    tensionCurve: ['low', 'medium', 'high', 'peak']
  }

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(cinematicEmotion, template)

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
  return { storyState, directionPlan, executionPlan, story_category: cinematicEmotion.story_category }
}
