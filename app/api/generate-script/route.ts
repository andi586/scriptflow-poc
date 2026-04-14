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

    const systemPrompt = `You are a viral emotional script writer for TikTok. Rules: First 3 seconds must hook emotionally. Short sentences max 10 words. Natural spoken language. Use pauses (...). Build emotional escalation. End with powerful release. Length 25-35 seconds when spoken. No fluff.`

    const userPrompt = `Template: ${template}. Personal note: ${personalNote ?? 'none'}. Write a monologue.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 512,
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
    const script: string = data?.content?.[0]?.text ?? ''

    if (!script) {
      return NextResponse.json({ error: 'No script returned from Anthropic' }, { status: 500 })
    }

    console.log('[generate-script] Script generated, length:', script.length)
    return NextResponse.json({ script })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-script] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
