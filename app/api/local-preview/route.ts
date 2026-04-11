import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/local-preview
 *
 * Fallback preview generator when D-ID is unavailable.
 * Uses ElevenLabs TTS to generate audio, then returns a static
 * placeholder video URL (or just the audio URL as a fallback).
 *
 * Returns: { videoUrl: string }
 */
export async function POST(request: NextRequest) {
  console.log('[local-preview] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const { imageUrl, text } = body as { imageUrl?: string; text?: string }

    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // ── Step 1: ElevenLabs TTS → mp3 ─────────────────────────────────────────
    const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Luna (Chinese-capable)

    let audioUrl: string | null = null

    if (elevenLabsKey) {
      try {
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              language_code: 'zh',
              output_format: 'mp3_44100_128',
              voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
            }),
          }
        )

        if (ttsRes.ok) {
          const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
          const supabase = createClient(supabaseUrl, serviceKey)
          const audioPath = `local-preview/audio_${Date.now()}.mp3`

          const { error: uploadErr } = await supabase.storage
            .from('recordings')
            .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

          if (!uploadErr) {
            audioUrl = supabase.storage.from('recordings').getPublicUrl(audioPath).data.publicUrl
            console.log('[local-preview] TTS audio uploaded:', audioUrl)
          }
        } else {
          console.warn('[local-preview] TTS failed:', ttsRes.status)
        }
      } catch (ttsErr) {
        console.warn('[local-preview] TTS error (non-fatal):', ttsErr instanceof Error ? ttsErr.message : ttsErr)
      }
    }

    // ── Step 2: Return audio URL as videoUrl fallback ─────────────────────────
    // The frontend video element won't play an mp3, but this signals success
    // so the paywall can still be shown. A proper fallback would composite
    // the image + audio into a video server-side (future improvement).
    if (audioUrl) {
      console.log('[local-preview] returning audio-only fallback')
      return NextResponse.json({ videoUrl: audioUrl, fallback: true, fallbackType: 'audio' })
    }

    // ── Step 3: Last resort — return imageUrl as a static "video" ─────────────
    // Frontend will fail to play it as video, but at least won't crash.
    console.warn('[local-preview] no audio generated, returning imageUrl as last resort')
    return NextResponse.json({
      videoUrl: imageUrl ?? '',
      fallback: true,
      fallbackType: 'image',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[local-preview] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
