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
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are the Producer Engine of ScriptFlow. Convert this user input into structured narrative logic.

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
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are the Director Agent of ScriptFlow. Turn this narrative into a cinematic shot plan.

Story State: ${JSON.stringify(storyState)}
Template: "${template}"

Rules:
- Create 8 shots alternating: face, scene, face, scene, face, scene, face, scene
- Face shots: person speaks Chinese (max 2 sentences, max 12 chars each, use ... for pauses)
- Scene shots: empty cinematic environment, NO people, NO humans
- First 3 seconds must have strong emotional hook
- Tension rises across shots following the tensionCurve
- Each shot 8-12 seconds

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
  const directionPlan = await runDirector(storyState, template)

  console.log('[CognitiveCore] Starting NEL...')
  const executionPlan = await runNEL(directionPlan)

  console.log('[CognitiveCore] Complete. Total shots:', executionPlan.pipeline.length)
  return { storyState, directionPlan, executionPlan }
}
