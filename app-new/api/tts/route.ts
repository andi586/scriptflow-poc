import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * TTS (Text-to-Speech) API — ElevenLabs
 *
 * POST /api/tts
 * Body: {
 *   text: string          — dialogue / voiceover text
 *   language?: string     — ISO 639-1 code, e.g. "zh", "en", "ja"
 *   voiceId?: string      — ElevenLabs voice ID (overrides default)
 *   voiceStyle?: "natural" | "enhanced" | "cinematic"
 * }
 *
 * Chinese support:
 *   - When language === "zh", language_code is set to "zh" in the TTS request
 *   - A multilingual voice that supports Chinese is used by default
 *     (ElevenLabs "Aria" — voice ID: 9BWtsMINqrJLrRacOk9x — supports zh)
 *   - Callers can override with their own voiceId
 *
 * Returns: audio/mpeg stream (or JSON error)
 */

// ElevenLabs multilingual voice that supports Chinese (Mandarin)
// "Aria" — a versatile multilingual voice
const DEFAULT_VOICE_ID = '9BWtsMINqrJLrRacOk9x'

// Map ISO 639-1 → ElevenLabs language_code
const LANG_CODE_MAP: Record<string, string> = {
  zh: 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  ar: 'ar',
  hi: 'hi',
  ru: 'ru',
  th: 'th',
  vi: 'vi',
}

export async function POST(request: NextRequest) {
  console.log('[tts] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const {
      text,
      language,
      voiceId,
      voiceStyle,
    } = body as {
      text?: string
      language?: string
      voiceId?: string
      voiceStyle?: 'natural' | 'enhanced' | 'cinematic'
    }

    console.log('[tts] params:', { language, voiceStyle, hasVoiceId: !!voiceId, textLen: text?.length ?? 0 })

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      console.error('[tts] ELEVENLABS_API_KEY not set')
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    // ── Determine voice ID ────────────────────────────────────────────────────
    // Use caller-supplied voiceId, or fall back to the multilingual default
    const effectiveVoiceId = voiceId ?? DEFAULT_VOICE_ID

    // ── Determine language_code ───────────────────────────────────────────────
    // Normalise: "zh-CN", "zh-TW", "zh_CN" → "zh"
    const normLang = (language ?? 'en').toLowerCase().split(/[-_]/)[0]
    const languageCode = LANG_CODE_MAP[normLang] ?? 'en'

    console.log('[tts] effectiveVoiceId:', effectiveVoiceId, '| languageCode:', languageCode)

    // ── Voice settings based on voiceStyle ────────────────────────────────────
    const voiceSettings: Record<string, number | boolean> = {
      stability: 0.75,
      similarity_boost: 0.75,
    }
    if (voiceStyle === 'enhanced') {
      voiceSettings.stability = 0.85
      voiceSettings.use_speaker_boost = true
    } else if (voiceStyle === 'cinematic') {
      voiceSettings.stability = 0.9
      voiceSettings.style = 0.6
    }

    // ── Call ElevenLabs TTS ───────────────────────────────────────────────────
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}`

    const ttsPayload: Record<string, unknown> = {
      text: text.trim(),
      model_id: 'eleven_turbo_v2_5', // supports multilingual including Chinese
      language_code: languageCode,
      voice_settings: voiceSettings,
    }

    console.log('[tts] calling ElevenLabs:', ttsUrl, '| model: eleven_turbo_v2_5 | lang:', languageCode)

    const ttsRes = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(ttsPayload),
    })

    console.log('[tts] ElevenLabs response status:', ttsRes.status)

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => 'unknown')
      console.error('[tts] ElevenLabs error:', ttsRes.status, errText)
      return NextResponse.json(
        { error: `ElevenLabs TTS failed: ${ttsRes.status} ${errText}` },
        { status: 502 }
      )
    }

    // ── Stream audio back to caller ───────────────────────────────────────────
    const audioBuffer = await ttsRes.arrayBuffer()
    console.log('[tts] audio bytes:', audioBuffer.byteLength)

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[tts] FATAL error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
