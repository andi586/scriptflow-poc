import Anthropic from '@anthropic-ai/sdk'

export interface NarrativeState {
  tension: number      // 0-10
  beat: string         // 'setup' | 'conflict' | 'peak' | 'release'
  goal: string
  emotion: string
}

export interface Shot {
  shot_index: number
  type: 'face' | 'scene'
  duration: number
  text?: string        // for face shots
  scene?: string       // for scene shots (no people, no humans)
  narrative: NarrativeState
}

export interface DirectorOutput {
  title: string
  total_duration: number
  shots: Shot[]
}

export async function runDirector(story: string, template: string): Promise<DirectorOutput> {
  const client = new Anthropic()
  
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a film director AI. Create a shot timeline for this emotional story.

Story: "${story}"
Template: "${template}"

Rules:
- Create EXACTLY 8 shots: 4 face shots + 4 scene shots, strictly alternating (face, scene, face, scene, ...)
- Face shots: person speaks (8-10 seconds each)
- Scene shots: empty cinematic scene, NO people, NO humans (4-6 seconds each)
- Tension rises from 2 to 10 across the shots
- Total duration: 60-70 seconds
- Chinese language for face shot text

STRICT face shot text rules:
- Maximum 2 sentences per shot
- Maximum 15 Chinese characters per sentence
- Must include at least one '...' pause per shot
- Speak slowly, emotionally, with breathing room

GOOD examples (short, with pauses):
"妈妈... 我好想你。"
"十五年了... 我还是会梦见你。"
"你走的那天... 我没来得及说再见。"

BAD examples (too long, no pauses — DO NOT do this):
"妈妈这是你离开后的第15个母亲节我也老了昨晚我梦见你了"

Return ONLY valid JSON:
{
  "title": "video title",
  "total_duration": 65,
  "shots": [
    {
      "shot_index": 1,
      "type": "face",
      "duration": 9,
      "text": "妈妈... 我好想你。",
      "scene": null,
      "narrative": { "tension": 2, "beat": "setup", "goal": "connect with mom", "emotion": "tender" }
    },
    {
      "shot_index": 2,
      "type": "scene",
      "duration": 5,
      "text": null,
      "scene": "empty room with warm candlelight, flowers on table, no people, no humans",
      "narrative": { "tension": 3, "beat": "setup", "goal": "establish mood", "emotion": "warm" }
    }
  ]
}`
    }]
  })
  
  const raw = (response.content[0] as { text: string }).text
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean) as DirectorOutput
}
