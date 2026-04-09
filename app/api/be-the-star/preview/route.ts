import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/be-the-star/preview
 *
 * Flow:
 * 1. Receive { imageUrl, firstLine } — imageUrl is user's uploaded photo URL
 * 2. Call ElevenLabs TTS to generate mp3 audio for firstLine
 * 3. Upload mp3 to Supabase Storage → get HTTPS URL
 * 4. Call OmniHuman (PiAPI) with imageUrl + audioUrl
 * 5. Poll until done (max 60s)
 * 6. Return { videoUrl }
 */
export async function POST(request: NextRequest) {
  console.log('[be-the-star/preview] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const imageUrl = body.imageUrl as string | null
    const firstLine = body.firstLine as string | null

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }
    if (!firstLine) {
      return NextResponse.json({ error: 'firstLine is required' }, { status: 400 })
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }
    if (!piApiKey) {
      return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
    }

    // ── Step 1: ElevenLabs TTS → mp3 buffer ──────────────────────────────────
    const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Luna
    console.log('[be-the-star/preview] calling ElevenLabs TTS for:', firstLine.slice(0, 60))

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text: firstLine,
          model_id: 'eleven_multilingual_v2',
          output_format: 'mp3_44100_128',
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
        }),
      }
    )

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => 'unknown')
      console.error('[be-the-star/preview] ElevenLabs TTS error:', ttsRes.status, errText)
      return NextResponse.json({ error: `TTS failed: ${ttsRes.status}` }, { status: 502 })
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
    console.log('[be-the-star/preview] TTS audio size:', audioBuffer.length)

    // ── Step 2: Upload mp3 to Supabase Storage ────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceKey)
    const audioPath = `be-the-star/preview_${Date.now()}.mp3`

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadError) {
      console.error('[be-the-star/preview] Supabase upload error:', uploadError.message)
      return NextResponse.json({ error: `Audio upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const audioUrl = supabase.storage.from('recordings').getPublicUrl(audioPath).data.publicUrl
    console.log('[be-the-star/preview] audioUrl:', audioUrl)

    // ── Step 3: Submit OmniHuman task ─────────────────────────────────────────
    const PIAPI_BASE = 'https://api.piapi.ai/api/v1'
    const taskPayload = {
      model: 'omni-human',
      task_type: 'omni-human-1.5',
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        prompt: 'person speaks naturally cinematic',
        fast_mode: true,
      },
    }

    console.log('[be-the-star/preview] submitting OmniHuman task')
    const submitRes = await fetch(`${PIAPI_BASE}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
      body: JSON.stringify(taskPayload),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => 'unknown')
      console.error('[be-the-star/preview] OmniHuman submit failed:', submitRes.status, errText)
      return NextResponse.json({ error: `OmniHuman submit failed: ${submitRes.status}` }, { status: 502 })
    }

    const submitData = await submitRes.json()
    const taskId: string = submitData?.data?.task_id ?? submitData?.task_id
    console.log('[be-the-star/preview] task_id:', taskId)

    if (!taskId) {
      return NextResponse.json({ error: 'No task_id from OmniHuman' }, { status: 502 })
    }

    // ── Step 4: Poll for result (max 60s) ─────────────────────────────────────
    const POLL_INTERVAL_MS = 3000
    const MAX_ATTEMPTS = 20
    let videoUrl: string | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      console.log(`[be-the-star/preview] poll ${attempt}/${MAX_ATTEMPTS}`)

      const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
        headers: { 'x-api-key': piApiKey },
      })

      if (!pollRes.ok) { console.warn(`[be-the-star/preview] poll ${attempt} failed: ${pollRes.status}`); continue }

      const pollData = await pollRes.json()
      const status: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
      console.log(`[be-the-star/preview] poll ${attempt} status: ${status}`)

      if (status === 'completed' || status === 'success') {
        videoUrl =
          pollData?.data?.output?.video_url ??
          pollData?.data?.output?.url ??
          pollData?.output?.video_url ??
          pollData?.output?.url ??
          null
        console.log('[be-the-star/preview] videoUrl:', videoUrl)
        break
      }

      if (status === 'failed' || status === 'error') {
        const errMsg = pollData?.data?.error ?? pollData?.error ?? 'unknown'
        console.error('[be-the-star/preview] task failed:', errMsg)
        return NextResponse.json({ error: `OmniHuman task failed: ${errMsg}` }, { status: 502 })
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'OmniHuman timed out' }, { status: 504 })
    }

    return NextResponse.json({ success: true, videoUrl, audioUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[be-the-star/preview] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
