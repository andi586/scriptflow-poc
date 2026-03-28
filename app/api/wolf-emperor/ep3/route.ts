import { NextRequest, NextResponse } from 'next/server'

type WolfEmperorEp3RequestBody = {
  previousEpisodeSummary: string
  characterNotes: string
}

type KeyScene = {
  sceneNumber: number
  description: string
  emotionalBeat: string
}

type CharacterDevelopment = {
  character: string
  arc: string
}

type WolfEmperorEp3Response = {
  episodeTitle: string
  logline: string
  threeActStructure: { act1: string; act2: string; act3: string }
  keyScenes: KeyScene[]
  cliffhanger: string
  characterDevelopment: CharacterDevelopment[]
}

type AnthropicTextBlock = { type: 'text'; text: string }
type AnthropicMessageResponse = {
  id: string; type: 'message'; role: 'assistant'; model: string
  content: AnthropicTextBlock[]; stop_reason: string | null; stop_sequence: string | null
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function buildSystemPrompt(): string {
  return `You are a premium TV drama story architect for ScriptFlow.
Generate the structural outline for Wolf Emperor Episode 3.
Context: EP1 released on TikTok. EP2 introduced Marcus as antagonist. EP3 must advance the main conflict.
Return valid JSON only. No markdown. No prose outside JSON.
Use exactly this schema:
{
  "episodeTitle": "string",
  "logline": "string",
  "threeActStructure": { "act1": "string", "act2": "string", "act3": "string" },
  "keyScenes": [{ "sceneNumber": 1, "description": "string", "emotionalBeat": "string" }],
  "cliffhanger": "string",
  "characterDevelopment": [{ "character": "string", "arc": "string" }]
}
Include 5 to 8 keyScenes. Make cliffhanger create strong urgency for EP4.`
}

function buildUserPrompt(input: WolfEmperorEp3RequestBody): string {
  return `Generate Wolf Emperor EP3 structure.\n\nPREVIOUS EPISODE SUMMARY:\n${input.previousEpisodeSummary.trim()}\n\nCHARACTER NOTES:\n${input.characterNotes.trim()}`
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const first = trimmed.indexOf('{'); const last = trimmed.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return trimmed.slice(first, last + 1)
}

function safeJsonParse<T>(value: string): T | null {
  try { return JSON.parse(value) as T } catch { return null }
}

function isValidKeyScene(v: unknown): v is KeyScene {
  if (!v || typeof v !== 'object') return false
  const c = v as Partial<KeyScene>
  return typeof c.sceneNumber === 'number' && c.sceneNumber > 0 && isNonEmptyString(c.description) && isNonEmptyString(c.emotionalBeat)
}

function isValidCharDev(v: unknown): v is CharacterDevelopment {
  if (!v || typeof v !== 'object') return false
  const c = v as Partial<CharacterDevelopment>
  return isNonEmptyString(c.character) && isNonEmptyString(c.arc)
}

function validateShape(v: unknown): v is WolfEmperorEp3Response {
  if (!v || typeof v !== 'object') return false
  const c = v as Partial<WolfEmperorEp3Response>
  if (!isNonEmptyString(c.episodeTitle) || !isNonEmptyString(c.logline) || !isNonEmptyString(c.cliffhanger)) return false
  if (!c.threeActStructure || typeof c.threeActStructure !== 'object') return false
  const a = c.threeActStructure as Partial<WolfEmperorEp3Response['threeActStructure']>
  if (!isNonEmptyString(a.act1) || !isNonEmptyString(a.act2) || !isNonEmptyString(a.act3)) return false
  if (!Array.isArray(c.keyScenes) || c.keyScenes.length < 5 || !c.keyScenes.every(isValidKeyScene)) return false
  if (!Array.isArray(c.characterDevelopment) || !c.characterDevelopment.every(isValidCharDev)) return false
  return true
}

async function callAnthropic(input: WolfEmperorEp3RequestBody): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: 1800, temperature: 0.7,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
    }),
  })
  if (!response.ok) { const t = await response.text(); throw new Error(`Anthropic API failed ${response.status}: ${t}`) }
  const data = (await response.json()) as AnthropicMessageResponse
  if (!Array.isArray(data.content) || data.content.length === 0) throw new Error('Empty content')
  const textBlock = data.content.find((b): b is AnthropicTextBlock => b.type === 'text')
  if (!textBlock) throw new Error('No text block')
  return textBlock.text
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<WolfEmperorEp3RequestBody>
    if (!isNonEmptyString(body.previousEpisodeSummary)) return NextResponse.json({ error: 'previousEpisodeSummary is required' }, { status: 400 })
    if (!isNonEmptyString(body.characterNotes)) return NextResponse.json({ error: 'characterNotes is required' }, { status: 400 })
    const input = { previousEpisodeSummary: body.previousEpisodeSummary.trim(), characterNotes: body.characterNotes.trim() }
    if (input.previousEpisodeSummary.length < 20) return NextResponse.json({ error: 'previousEpisodeSummary too short' }, { status: 400 })
    const raw = await callAnthropic(input)
    const jsonText = extractJsonObject(raw)
    if (!jsonText) throw new Error('No JSON in response')
    const parsed = safeJsonParse<unknown>(jsonText)
    if (!parsed || !validateShape(parsed)) throw new Error('Invalid response shape')
    return NextResponse.json(parsed, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 })
  }
}
