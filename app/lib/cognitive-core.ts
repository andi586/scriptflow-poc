import Anthropic from '@anthropic-ai/sdk'

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
}

const client = new Anthropic()

async function runProducer(userInput: string, template: string): Promise<StoryState> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a master film producer. Analyze this story and extract deep emotional truth.
Focus on: what is the REAL emotion underneath the words? What does this person truly want to say?

User Input: "${userInput}"
Template: "${template}"

Return ONLY valid JSON (no markdown):
{
  "world": "brief world description",
  "characters": [{"name": "string", "role": "string", "goal": "string", "state": "string"}],
  "relationships": "string",
  "coreConflict": "string",
  "narrativeGoal": "string",
  "tensionCurve": ["low","medium","high","peak"]
}`
    }]
  })
  const raw = (response.content[0] as { text: string }).text
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

async function runDirector(storyState: StoryState, template: string): Promise<DirectionPlan> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are an award-winning film director specializing in emotional short films.

Story State: ${JSON.stringify(storyState)}
Template: "${template}"

STRICT RULES for face shots:
- Maximum 2 sentences, maximum 10 Chinese characters each
- MUST use '...' for natural pauses (at least one per shot)
- Sentences must feel like real spoken words, not written text
- Emotion must ESCALATE across shots following tensionCurve
- First shot MUST hook in 3 seconds: start with '妈妈...' or similar intimate address

STRICT RULES for scene shots:
- Describe EMPTY cinematic environment only
- NO people, NO humans, NO figures
- Must match emotional tone of adjacent face shots
- Use cinematic language: lighting, texture, movement

BAD example face shot (too long, too formal):
'这是你离开后的第十五个母亲节，我也渐渐老去'

GOOD example face shot (short, intimate, with pause):
'妈妈... 十五年了。'

Create 8 shots alternating: face, scene, face, scene, face, scene, face, scene
Each shot 8-12 seconds.

Return ONLY valid JSON (no markdown):
{
  "style": "cinematic",
  "hook": "first line that grabs attention",
  "shots": [
    {
      "shotNumber": 1,
      "type": "close-up",
      "cameraMovement": "static",
      "duration": 10,
      "description": "person speaking",
      "emotion": "tender",
      "shotType": "face",
      "dialogue": "妈妈... 我想你。"
    },
    {
      "shotNumber": 2,
      "type": "wide",
      "cameraMovement": "push",
      "duration": 8,
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
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
  const storyState = await runProducer(userInput, template)

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(storyState, template)

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
  return { storyState, directionPlan, executionPlan }
}
