import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Detect the language of the text using Claude.
 * Returns ISO 639-1 code (e.g. "zh", "en", "ja", "ko", "es").
 * This is the source of truth — we do NOT use ASCII heuristics.
 */
async function detectLanguage(text: string): Promise<string> {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [
      {
        role: 'user',
        content: `Detect the language of this text. Reply with ONLY the ISO 639-1 two-letter code (e.g. "zh", "en", "ja", "ko", "es", "fr", "ar", "hi", "pt", "de"). No explanation.\n\nText: ${text.slice(0, 200)}`,
      },
    ],
  })
  const code = res.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .toLowerCase()
    .slice(0, 5)
  console.log('[translate] detected language code:', code)
  return code
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, targetLanguage } = body as { text?: string; targetLanguage?: string }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'text cannot be empty' }, { status: 400 })
    }

    // Step 1: Detect source language
    const detectedLang = await detectLanguage(trimmed)
    console.log('[translate] source text (first 80 chars):', trimmed.slice(0, 80))
    console.log('[translate] detectedLang:', detectedLang)

    // Step 2: Determine target language
    // If caller specifies targetLanguage, use it.
    // Otherwise: if source is already English, keep English.
    // If source is non-English, keep the ORIGINAL language for voiceover/subtitles
    // (三统一: input lang = voiceover lang = subtitle lang).
    const target = targetLanguage ?? (detectedLang === 'en' ? 'en' : detectedLang)
    console.log('[translate] target language:', target)

    // Step 3: If source == target, no translation needed
    if (detectedLang === target) {
      console.log('[translate] no translation needed, returning original')
      return NextResponse.json({
        translated: trimmed,
        wasTranslated: false,
        detectedLanguage: detectedLang,
        targetLanguage: target,
      })
    }

    // Step 4: Translate to target language
    const langNames: Record<string, string> = {
      en: 'English', zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean',
      es: 'Spanish', fr: 'French', ar: 'Arabic', hi: 'Hindi', pt: 'Portuguese',
      de: 'German', it: 'Italian', ru: 'Russian', th: 'Thai', vi: 'Vietnamese',
    }
    const targetName = langNames[target] ?? target

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a professional translator. Translate the following text to ${targetName}.
Output ONLY the translation, nothing else. No explanations, no notes, no original text.

Text to translate:
${trimmed}`,
        },
      ],
    })

    const translated =
      response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim() || trimmed

    console.log('[translate] translated (first 80 chars):', translated.slice(0, 80))

    return NextResponse.json({
      translated,
      wasTranslated: true,
      original: trimmed,
      detectedLanguage: detectedLang,
      targetLanguage: target,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/translate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
