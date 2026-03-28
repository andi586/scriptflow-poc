import { NextRequest, NextResponse } from 'next/server'

type InputType = 'prompt' | 'script'

interface HtsScoreRequestBody {
  text: string
  type: InputType
}

interface HtsDimension {
  name: 'Emotional Authenticity' | 'Narrative Unpredictability' | 'Character Complexity' | 'Visual Imperfection' | 'Cultural Specificity' | 'Rhythm Naturalness'
  score: number
  weight: number
}

interface HtsScoreResponse {
  total: number
  passed: boolean
  dimensions: HtsDimension[]
  suggestions: string[]
}

interface AnthropicTextBlock { type: 'text'; text: string }
interface AnthropicMessageResponse {
  id: string; type: 'message'; role: 'assistant'; model: string
  content: AnthropicTextBlock[]; stop_reason: string | null; stop_sequence: string | null
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'

const EXPECTED_DIMENSIONS: ReadonlyArray<{ name: HtsDimension['name']; weight: number }> = [
  { name: 'Emotional Authenticity', weight: 0.25 },
  { name: 'Narrative Unpredictability', weight: 0.2 },
  { name: 'Character Complexity', weight: 0.2 },
  { name: 'Visual Imperfection', weight: 0.15 },
  { name: 'Cultural Specificity', weight: 0.1 },
  { name: 'Rhythm Naturalness', weight: 0.1 },
] as const

function isInputType(value: unknown): value is InputType { return value === 'prompt' || value === 'script' }
function isNonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function roundToTwo(value: number): number { return Math.round(value * 100) / 100 }
function clampScore(value: number): number { if (!Number.isFinite(value)) return 0; return roundToTwo(Math.min(Math.max(value, 0), 10)) }

function getSystemPrompt(): string {
  return `You are ScriptFlow HTS (Human Touch Standard) evaluator.
Evaluate the provided text and score it on 6 dimensions from 0 to 10.
Return JSON only. No markdown. No prose outside JSON.
The JSON schema must be exactly:
{
  "dimensions": [
    { "name": "Emotional Authenticity", "score": number, "weight": 0.25 },
    { "name": "Narrative Unpredictability", "score": number, "weight": 0.20 },
    { "name": "Character Complexity", "score": number, "weight": 0.20 },
    { "name": "Visual Imperfection", "score": number, "weight": 0.15 },
    { "name": "Cultural Specificity", "score": number, "weight": 0.10 },
    { "name": "Rhythm Naturalness", "score": number, "weight": 0.10 }
  ],
  "suggestions": ["string", "string"]
}
Scoring guidance:
- Emotional Authenticity: believable emotional truth, vulnerability, contradiction.
- Narrative Unpredictability: avoids formula, tension, reversals, surprising turns.
- Character Complexity: mixed motives, inner conflict, layered psychology.
- Visual Imperfection: concrete messy human details, texture, non-polished realism.
- Cultural Specificity: concrete place, class, ritual, slang, not generic blandness.
- Rhythm Naturalness: human cadence, pauses, tonal variation, not robotic.
Use decimals when useful. Do not compute total. Only return dimensions and suggestions.`
}

function getUserPrompt(text: string, type: InputType): string {
  return `Content type: ${type}\n\nTask: score this content for HTS.\nReturn valid JSON only.\n\nContent:\n${text}`
}

function safeJsonParse<T>(value: string): T | null {
  try { return JSON.parse(value) as T } catch { return null }
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const first = trimmed.indexOf('{'); const last = trimmed.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  return trimmed.slice(first, last + 1)
}

function validateAndNormalizeDimensions(input: unknown): HtsDimension[] | null {
  if (!Array.isArray(input)) return null
  const byName = new Map<string, HtsDimension>()
  for (const item of input) {
    if (!item || typeof item !== 'object') return null
    const c = item as Partial<HtsDimension>
    if (!isNonEmptyString(c.name) || typeof c.score !== 'number' || typeof c.weight !== 'number') return null
    byName.set(c.name, { name: c.name as HtsDimension['name'], score: clampScore(c.score), weight: c.weight })
  }
  const normalized: HtsDimension[] = []
  for (const expected of EXPECTED_DIMENSIONS) {
    const found = byName.get(expected.name)
    if (!found) return null
    normalized.push({ name: expected.name, score: clampScore(found.score), weight: expected.weight })
  }
  return normalized
}

function validateAndNormalizeSuggestions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((i): i is string => typeof i === 'string').map(i => i.trim()).filter(i => i.length > 0).slice(0, 8)
}

function calculateTotal(dimensions: HtsDimension[]): number {
  return roundToTwo(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))
}

async function callAnthropic(text: string, type: InputType): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: 1200, temperature: 0.2,
      system: getSystemPrompt(),
      messages: [{ role: 'user', content: getUserPrompt(text, type) }],
    }),
  })
  if (!response.ok) { const t = await response.text(); throw new Error(`Anthropic API failed ${response.status}: ${t}`) }
  const data = (await response.json()) as AnthropicMessageResponse
  if (!Array.isArray(data.content) || data.content.length === 0) throw new Error('Anthropic API returned empty content')
  const textBlock = data.content.find((b): b is AnthropicTextBlock => b.type === 'text' && typeof b.text === 'string')
  if (!textBlock) throw new Error('Anthropic API returned no text block')
  return textBlock.text
}

function parseAnthropicResult(raw: string): Pick<HtsScoreResponse, 'dimensions' | 'suggestions'> {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) throw new Error('Claude response did not contain valid JSON')
  const parsed = safeJsonParse<{ dimensions?: unknown; suggestions?: unknown }>(jsonText)
  if (!parsed) throw new Error('Failed to parse Claude JSON response')
  const dimensions = validateAndNormalizeDimensions(parsed.dimensions)
  if (!dimensions) throw new Error('Claude JSON dimensions were invalid or incomplete')
  return { dimensions, suggestions: validateAndNormalizeSuggestions(parsed.suggestions) }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<HtsScoreRequestBody>
    if (!isNonEmptyString(body.text)) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    if (!isInputType(body.type)) return NextResponse.json({ error: 'type must be "prompt" or "script"' }, { status: 400 })
    const trimmedText = body.text.trim()
    if (trimmedText.length < 20) return NextResponse.json({ error: 'text is too short to score' }, { status: 400 })
    const rawClaudeResponse = await callAnthropic(trimmedText, body.type)
    const { dimensions, suggestions } = parseAnthropicResult(rawClaudeResponse)
    const total = calculateTotal(dimensions)
    const response: HtsScoreResponse = { total, passed: total >= 6, dimensions, suggestions }
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected server error' }, { status: 500 })
  }
}
