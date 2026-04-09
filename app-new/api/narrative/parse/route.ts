import { NextRequest, NextResponse } from 'next/server'
import { parseNelSentinelScript } from '@/lib/narrative-engine/parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { script, starPhotos, tier, maxShots, voiceStyle, beautyStyle, language } = body as {
      script?: string
      starPhotos?: Array<{ dataUrl: string; name: string }>
      tier?: 'preview' | 'full'
      maxShots?: number
      voiceStyle?: string
      beautyStyle?: string
      language?: string  // ISO 639-1 code of the original input language
    }

    console.log('[narrative/parse] ENTER', {
      tier: tier ?? 'full',
      maxShots,
      voiceStyle,
      beautyStyle,
      language,
      hasScript: !!script,
      starPhotosCount: starPhotos?.length ?? 0,
    })

    if (!script || typeof script !== 'string' || !script.trim()) {
      return NextResponse.json(
        { error: 'script text is required' },
        { status: 400 }
      )
    }

    // Build the script text, optionally noting star photos
    let scriptText = script.trim()
    if (starPhotos && starPhotos.length > 0) {
      scriptText = `[Star Photos: ${starPhotos.map(p => p.name).join(', ')}]\n\n${scriptText}`
    }

    // Append language instruction so NEL generates subtitles/voiceover in the correct language
    const outputLang = language ?? 'en'
    if (outputLang !== 'en') {
      scriptText = `[Output Language: ${outputLang} — all subtitles, voiceover lines, and dialogue must be in this language]\n\n${scriptText}`
      console.log('[narrative/parse] appended output language instruction:', outputLang)
    }

    // Append tier instruction
    const effectiveMaxShots = maxShots ?? (tier === 'preview' ? 3 : 5)
    scriptText = `[Generation Tier: ${tier ?? 'full'} — generate exactly ${effectiveMaxShots} shots]\n\n${scriptText}`
    console.log('[narrative/parse] effectiveMaxShots:', effectiveMaxShots)

    console.log('[narrative/parse] calling parseNelSentinelScript...')
    const narrative = await parseNelSentinelScript(scriptText, { language: outputLang })
    console.log('[narrative/parse] parseNelSentinelScript OK, scenes:', narrative.scenes?.length ?? 0, 'beats:', (narrative as any).beats?.length ?? 0)

    return NextResponse.json({
      success: true,
      narrative,
      starPhotosCount: starPhotos?.length ?? 0,
      tier: tier ?? 'full',
      maxShots: effectiveMaxShots,
      voiceStyle: voiceStyle ?? 'natural',
      beautyStyle: beautyStyle ?? 'natural',
      outputLanguage: outputLang,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/narrative/parse] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
