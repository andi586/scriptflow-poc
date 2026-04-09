import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Voice Clone API
 *
 * Flow:
 * 1. Receive audio blob (recorded video audio) + projectId
 * 2. Call ElevenLabs voice clone API to create a voice from the audio
 * 3. Store the returned voice_id in projects.user_voice_id
 * 4. Return voice_id to client
 *
 * The finalize pipeline reads projects.user_voice_id and uses it for TTS.
 */
export async function POST(request: NextRequest) {
  console.log('[voice-clone] ENTER', new Date().toISOString())

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const projectId = formData.get('projectId') as string | null
    const voiceStyle = (formData.get('voiceStyle') as string | null) ?? 'natural'

    console.log('[voice-clone] params:', {
      hasAudio: !!audioFile,
      audioSize: audioFile?.size ?? 0,
      audioType: audioFile?.type ?? 'unknown',
      projectId,
      voiceStyle,
    })

    if (!audioFile) {
      console.error('[voice-clone] ERROR: no audio file provided')
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 })
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      console.error('[voice-clone] ERROR: ELEVENLABS_API_KEY not set')
      // Return a stub voice_id so the pipeline can continue without crashing
      return NextResponse.json({
        success: false,
        error: 'ELEVENLABS_API_KEY not configured',
        voice_id: null,
        stub: true,
      })
    }

    // ── Step 1: Upload audio to ElevenLabs voice clone endpoint ──────────────
    console.log('[voice-clone] uploading audio to ElevenLabs...')
    const cloneForm = new FormData()
    cloneForm.append('name', `scriptflow_user_${projectId ?? Date.now()}`)
    cloneForm.append('description', 'ScriptFlow user voice clone')
    cloneForm.append('files', audioFile, 'recording.webm')
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
      console.error('[voice-clone] ElevenLabs request headers sent:', JSON.stringify({
        'xi-api-key': elevenLabsKey ? elevenLabsKey.slice(0, 8) + '...' : 'MISSING',
      }))
      console.error('[voice-clone] FormData fields: name, description, files, remove_background_noise')
      console.error('[voice-clone] audio file info:', {
        size: audioFile.size,
        type: audioFile.type,
        name: audioFile.name,
      })
      // Try to parse JSON error detail
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

    // ── Step 2: Store voice_id in projects.user_voice_id ─────────────────────
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
