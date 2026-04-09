import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Voice Clone API
 *
 * Flow:
 * 1. Receive JSON { audioUrl, projectId } — audioUrl is a Supabase Storage public URL
 * 2. Download the audio from Supabase Storage (server-side fetch, no size limit)
 * 3. Call ElevenLabs voice clone API to create a voice from the audio
 * 4. Store the returned voice_id in projects.user_voice_id
 * 5. Return voice_id to client
 */
export async function POST(request: NextRequest) {
  console.log('[voice-clone] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const audioUrl = body.audioUrl as string | null
    const projectId = body.projectId as string | null
    const voiceStyle = (body.voiceStyle as string | null) ?? 'natural'

    console.log('[voice-clone] params:', { audioUrl: audioUrl?.slice(0, 80), projectId, voiceStyle })

    if (!audioUrl) {
      console.error('[voice-clone] ERROR: no audioUrl provided')
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 })
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      console.error('[voice-clone] ERROR: ELEVENLABS_API_KEY not set')
      return NextResponse.json({
        success: false,
        error: 'ELEVENLABS_API_KEY not configured',
        voice_id: null,
        stub: true,
      })
    }

    // ── Step 1: Download audio from Supabase Storage ──────────────────────────
    console.log('[voice-clone] downloading audio from Supabase:', audioUrl.slice(0, 80))
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      console.error('[voice-clone] failed to download audio:', audioRes.status)
      return NextResponse.json({
        success: false,
        error: `Failed to download audio: ${audioRes.status}`,
        voice_id: null,
      }, { status: 502 })
    }
    const audioBuffer = await audioRes.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: audioRes.headers.get('content-type') || 'video/webm' })
    console.log('[voice-clone] downloaded audio, size:', audioBlob.size)

    // ── Step 2: Upload audio to ElevenLabs voice clone endpoint ──────────────
    console.log('[voice-clone] uploading audio to ElevenLabs...')
    const cloneForm = new FormData()
    cloneForm.append('name', `scriptflow_user_${projectId ?? Date.now()}`)
    cloneForm.append('description', 'ScriptFlow user voice clone')
    cloneForm.append('files', audioBlob, 'recording.webm')
    cloneForm.append('remove_background_noise', 'true')

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
      },
      body: cloneForm,
    })

    console.log('[voice-clone] ElevenLabs response status:', cloneRes.status)

    if (!cloneRes.ok) {
      const errText = await cloneRes.text().catch(() => 'unknown')
      console.error('[voice-clone] ElevenLabs error status:', cloneRes.status)
      console.error('[voice-clone] ElevenLabs error body:', errText)
      try {
        const errJson = JSON.parse(errText)
        console.error('[voice-clone] ElevenLabs error detail:', JSON.stringify(errJson))
      } catch {
        // not JSON, already logged as text
      }
      return NextResponse.json({
        success: false,
        error: `ElevenLabs voice clone failed: ${cloneRes.status} ${errText}`,
        voice_id: null,
      }, { status: 502 })
    }

    const cloneData = await cloneRes.json()
    const voiceId: string = cloneData.voice_id
    console.log('[voice-clone] ElevenLabs voice_id:', voiceId)

    // ── Step 3: Store voice_id in projects.user_voice_id ─────────────────────
    if (projectId && voiceId) {
      console.log('[voice-clone] storing voice_id in projects table, projectId:', projectId)
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        const { error: dbError } = await supabase
          .from('projects')
          .update({ user_voice_id: voiceId })
          .eq('id', projectId)

        if (dbError) {
          console.error('[voice-clone] DB update error:', dbError.message)
        } else {
          console.log('[voice-clone] DB update OK: projects.user_voice_id =', voiceId)
        }
      } catch (dbErr) {
        console.error('[voice-clone] DB error:', dbErr instanceof Error ? dbErr.message : dbErr)
      }
    } else {
      console.warn('[voice-clone] skipping DB update: projectId or voiceId missing', { projectId, voiceId })
    }

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      voiceStyle,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[voice-clone] FATAL error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
