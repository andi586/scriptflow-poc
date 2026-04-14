import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/generate-script
 * Body: { template: string, personalNote?: string }
 * Returns: { script: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { template, personalNote } = await request.json()

    if (!template) {
      return NextResponse.json({ error: 'template is required' }, { status: 400 })
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are an emotional script writer. Split the story into exactly 4 shots of 12 seconds each. Return ONLY valid JSON array, no other text:
[{"shot":1,"text":"script text","scene":"empty cinematic scene, no people, no humans, no figures"},{"shot":2,"text":"...","scene":"..."},{"shot":3,"text":"...","scene":"..."},{"shot":4,"text":"...","scene":"..."}]`

    const userPrompt = `Template: ${template}. Personal note: ${personalNote ?? 'none'}. Write a monologue.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[generate-script] Anthropic error:', res.status, errText)
      return NextResponse.json({ error: `Anthropic API error: ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    const rawText: string = data?.content?.[0]?.text ?? ''

    if (!rawText) {
      return NextResponse.json({ error: 'No script returned from Anthropic' }, { status: 500 })
    }

    let shots: unknown
    try {
      const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      shots = JSON.parse(cleanedText)
    } catch {
      console.error('[generate-script] Failed to parse JSON:', rawText)
      return NextResponse.json({ error: 'Failed to parse shots JSON from Anthropic' }, { status: 500 })
    }

    console.log('[generate-script] Shots generated:', Array.isArray(shots) ? (shots as unknown[]).length : 'not array')
    return NextResponse.json({ shots })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-script] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
