import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/digital-twin/create
 * Body: { videoUrl: string, sessionId: string }
 *
 * 1. Calls Railway /extract-frame to get a frame at 50% of the video
 * 2. Inserts a row into digital_twins table
 * 3. Async (non-blocking): extracts audio, clones voice with ElevenLabs, stores voice_id
 * 4. Returns { twinId, frameUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, sessionId } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const railwayUrl =
      process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'

    // ── Step 1: Extract frame from video via Railway ──────────────────────
    let frameUrl: string | null = null
    try {
      console.log('[digital-twin/create] Extracting frame from video:', videoUrl)
      const frameRes = await fetch(`${railwayUrl}/extract-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      })
      if (frameRes.ok) {
        const frameData = await frameRes.json()
        frameUrl = frameData.frameUrl ?? null
        console.log('[digital-twin/create] frameUrl:', frameUrl)
      } else {
        const errText = await frameRes.text()
        console.warn('[digital-twin/create] Railway extract-frame failed:', frameRes.status, errText)
      }
    } catch (frameErr) {
      console.warn('[digital-twin/create] Railway extract-frame error:', frameErr instanceof Error ? frameErr.message : frameErr)
    }

    if (!frameUrl) {
      return NextResponse.json({ error: 'Failed to extract frame from video' }, { status: 500 })
    }

    // ── Step 2: Get auth user (optional — falls back to sessionId) ────────
    let userId: string | null = null
    try {
      const authHeader = request.headers.get('authorization')
      if (authHeader) {
        const userSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: authHeader } } },
        )
        const { data } = await userSupabase.auth.getUser()
        userId = data?.user?.id ?? null
      }
    } catch {}

    // ── Step 3: Insert into digital_twins table ───────────────────────────
    const { data: twin, error: insertErr } = await supabaseAdmin
      .from('digital_twins')
      .insert({
        user_id: userId,
        session_id: sessionId ?? null,
        frame_url_mid: frameUrl,
        is_active: true,
      })
      .select('id, frame_url_mid')
      .single()

    if (insertErr) {
      console.error('[digital-twin/create] DB insert failed:', insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const twinId = twin.id
    console.log('[digital-twin/create] twin created:', twinId)

    // ── Step 4: Clone voice async (non-blocking) ──────────────────────────
    const elevenKey = process.env.ELEVENLABS_API_KEY
    if (elevenKey) {
      ;(async () => {
        try {
          console.log('[digital-twin/create] Extracting audio for voice clone...')
          const audioRes = await fetch(`${railwayUrl}/extract-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl }),
          })
          if (!audioRes.ok) {
            console.warn('[digital-twin/create] extract-audio failed:', audioRes.status, await audioRes.text())
            return
          }
          const { audioUrl } = await audioRes.json()
          if (!audioUrl) {
            console.warn('[digital-twin/create] extract-audio returned no audioUrl')
            return
          }
          console.log('[digital-twin/create] audioUrl:', audioUrl)

          // Download audio for ElevenLabs
          const audioResponse = await fetch(audioUrl)
          if (!audioResponse.ok) {
            console.warn('[digital-twin/create] Failed to download audio for voice clone')
            return
          }
          const audioBuffer = await audioResponse.arrayBuffer()
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

          // Clone voice with ElevenLabs
          const form = new FormData()
          form.append('name', `ScriptFlow_${twinId}`)
          form.append('description', 'User voice clone for ScriptFlow')
          form.append('files', audioBlob, 'voice.mp3')

          const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: { 'xi-api-key': elevenKey },
            body: form,
          })

          if (!cloneRes.ok) {
            console.warn('[digital-twin/create] ElevenLabs voice clone failed:', cloneRes.status, await cloneRes.text())
            return
          }

          const cloneData = await cloneRes.json()
          const voiceId: string | null = cloneData.voice_id ?? null
          if (!voiceId) {
            console.warn('[digital-twin/create] ElevenLabs returned no voice_id')
            return
          }

          // Store voiceId in digital_twins table
          await supabaseAdmin.from('digital_twins').update({ voice_id: voiceId }).eq('id', twinId)
          console.log('[twin/create] Voice cloned:', voiceId)
        } catch (voiceErr) {
          console.warn('[digital-twin/create] Voice clone error (non-fatal):', voiceErr instanceof Error ? voiceErr.message : voiceErr)
        }
      })()
    } else {
      console.warn('[digital-twin/create] ELEVENLABS_API_KEY not set, skipping voice clone')
    }

    return NextResponse.json({ twinId, frameUrl: twin.frame_url_mid })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[digital-twin/create] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
